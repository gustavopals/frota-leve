import Anthropic, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  RateLimitError,
} from '@anthropic-ai/sdk';
import type {
  Message,
  MessageParam,
  TextBlockParam,
  Tool,
} from '@anthropic-ai/sdk/resources/messages';
import { AIFeature, AIUsageStatus, prisma } from '@frota-leve/database';
import { PLAN_LIMITS } from '@frota-leve/shared';
import {
  buildAiCacheKey,
  getAiCacheTtlSeconds,
  getCachedAiResponse,
  setCachedAiResponse,
  shouldCacheAiResponse,
} from './cache';
import {
  AIConfigurationError,
  AIModelNotAllowedError,
  AIPlanRequiredError,
  AIProviderError,
  AIQuotaExceededError,
  AiError,
} from './errors';
import { computeCostUsdMicros } from './pricing';
import { checkAndReserveQuota, commitQuota, refundQuota } from './quota';
import type {
  AiClientInvokeParams,
  AiClientInvokeResult,
  AiPromptBlock,
  AiUsageMetrics,
} from './types';
import { MockAnthropicClient } from './__mocks__/mock-client';

const DEFAULT_TIMEOUT_MS: Record<AiClientInvokeParams['feature'], number> = {
  chat: 30_000,
  analysis: 60_000,
  report: 60_000,
  ocr: 15_000,
  anomaly: 60_000,
  scoring: 60_000,
};

const FEATURE_TO_DB_FEATURE: Record<AiClientInvokeParams['feature'], AIFeature> = {
  chat: AIFeature.CHAT,
  analysis: AIFeature.REPORT_ON_DEMAND,
  report: AIFeature.REPORT_ON_DEMAND,
  ocr: AIFeature.OCR_INVOICE,
  anomaly: AIFeature.ANOMALY_EXPLANATION,
  scoring: AIFeature.DRIVER_SCORING,
};

type CachedInvokeResult = {
  data: unknown;
  usage?: AiUsageMetrics;
  providerMessageId?: string;
  stopReason?: Message['stop_reason'];
  rawText?: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function estimateTokens(params: AiClientInvokeParams): number {
  const promptSize =
    params.system.length +
    params.messages.reduce((total, message) => total + message.content.length, 0);

  return Math.ceil(promptSize / 4) + params.maxTokens;
}

function toSystemBlocks(params: AiClientInvokeParams): string | TextBlockParam[] {
  const systemBlocks: TextBlockParam[] = [
    {
      type: 'text',
      text: params.system,
      cache_control: { type: 'ephemeral' },
    },
  ];

  const cacheableContext = params.messages
    .filter((message) => message.role === 'system')
    .map<TextBlockParam>((message) => ({
      type: 'text',
      text: message.content,
      cache_control: message.cacheable ? { type: 'ephemeral' } : undefined,
    }));

  return systemBlocks.concat(cacheableContext);
}

function toMessageContent(message: AiPromptBlock) {
  return [
    {
      type: 'text' as const,
      text: message.role === 'tool' ? `[tool_result]\n${message.content}` : message.content,
      cache_control: message.cacheable ? ({ type: 'ephemeral' } as const) : undefined,
    },
  ];
}

function mapMessages(params: AiClientInvokeParams) {
  return params.messages
    .filter((message) => message.role !== 'system')
    .map<MessageParam>((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: toMessageContent(message),
    }));
}

function mapToolChoice(params: AiClientInvokeParams) {
  if (!params.toolChoice) {
    return undefined;
  }

  if (params.toolChoice.type === 'none') {
    return { type: 'none' as const };
  }

  if (params.toolChoice.type === 'auto') {
    return {
      type: 'auto' as const,
      disable_parallel_tool_use: params.toolChoice.disableParallelToolUse,
    };
  }

  return {
    type: 'tool' as const,
    name: params.toolChoice.name,
    disable_parallel_tool_use: params.toolChoice.disableParallelToolUse,
  };
}

function mapTools(params: AiClientInvokeParams): Tool[] | undefined {
  return params.tools?.map<Tool>((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

function parseRetryAfterMs(error: APIError | RateLimitError): number | null {
  const retryAfter = error.headers?.get('retry-after');

  if (!retryAfter) {
    return null;
  }

  const asSeconds = Number(retryAfter);

  if (Number.isFinite(asSeconds)) {
    return Math.max(0, asSeconds * 1000);
  }

  const retryAt = Date.parse(retryAfter);

  if (Number.isNaN(retryAt)) {
    return null;
  }

  return Math.max(0, retryAt - Date.now());
}

function getRetryDelayMs(error: unknown, attempt: number): number | null {
  if (error instanceof RateLimitError) {
    return parseRetryAfterMs(error) ?? 500 * 2 ** attempt + Math.floor(Math.random() * 250);
  }

  if (
    error instanceof APIConnectionError ||
    error instanceof APIConnectionTimeoutError ||
    (error instanceof APIError && typeof error.status === 'number' && error.status >= 500)
  ) {
    return 500 * 2 ** attempt + Math.floor(Math.random() * 250);
  }

  return null;
}

function extractResult<T>(
  response: Message,
): Pick<AiClientInvokeResult<T>, 'data' | 'providerMessageId' | 'stopReason' | 'rawText'> {
  const textParts: string[] = [];
  const toolUses: Array<{ id: string; name: string; input: unknown }> = [];

  for (const block of response.content) {
    if (block.type === 'text') {
      textParts.push(block.text);
      continue;
    }

    if (block.type === 'tool_use') {
      toolUses.push({
        id: block.id,
        name: block.name,
        input: block.input,
      });
    }
  }

  const rawText = textParts.join('\n').trim();
  let data: unknown;

  if (toolUses.length === 1 && rawText.length === 0) {
    data = toolUses[0].input;
  } else if (toolUses.length > 0) {
    data = {
      text: rawText,
      toolUses,
    };
  } else if (rawText.length === 0) {
    data = null;
  } else {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }
  }

  return {
    data: data as T,
    providerMessageId: response.id,
    stopReason: response.stop_reason,
    rawText,
  };
}

function toUsageMetrics(response: Message, latencyMs: number): AiUsageMetrics {
  return {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
    latencyMs,
  };
}

export class AiClient {
  private provider: Anthropic | null = null;
  private mockProvider: MockAnthropicClient | null = null;

  private isMockEnabled(): boolean {
    return process.env.AI_MOCK === 'true';
  }

  private getMockProvider(): MockAnthropicClient {
    if (!this.mockProvider) {
      this.mockProvider = new MockAnthropicClient();
    }

    return this.mockProvider;
  }

  private getProvider(): Anthropic {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new AIConfigurationError(
        'ANTHROPIC_API_KEY nao configurada. Defina a variavel antes de usar o AiClient.',
      );
    }

    if (!this.provider) {
      this.provider = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
        maxRetries: 0,
      });
    }

    return this.provider;
  }

  private async validateTenantAccess(params: AiClientInvokeParams): Promise<void> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: params.tenantId },
      select: { plan: true },
    });

    if (!tenant) {
      throw new AiError(`Tenant ${params.tenantId} nao foi encontrado.`);
    }

    const limits = PLAN_LIMITS[tenant.plan];

    if (!limits.hasAI) {
      throw new AIPlanRequiredError(params.tenantId);
    }

    if (!limits.aiModelsAllowed.includes(params.model)) {
      throw new AIModelNotAllowedError(params.model);
    }
  }

  private async persistUsageLog(params: {
    tenantId: string;
    userId?: string;
    feature: AIFeature;
    model: string;
    usage?: AiUsageMetrics;
    status: AIUsageStatus;
    errorCode?: string;
  }): Promise<void> {
    await prisma.aIUsageLog.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        feature: params.feature,
        model: params.model,
        inputTokens: params.usage?.inputTokens ?? 0,
        outputTokens: params.usage?.outputTokens ?? 0,
        cacheReadTokens: params.usage?.cacheReadTokens ?? 0,
        cacheCreationTokens: params.usage?.cacheCreationTokens ?? 0,
        costUsdMicros: computeCostUsdMicros(params.usage ?? {}, params.model),
        latencyMs: params.usage?.latencyMs ?? 0,
        status: params.status,
        errorCode: params.errorCode,
      },
    });
  }

  private async invokeProvider<T>(
    params: AiClientInvokeParams,
  ): Promise<AiClientInvokeResult<T> & { usage: AiUsageMetrics }> {
    if (this.isMockEnabled()) {
      const mockResponse = await this.getMockProvider().invoke<T>(params);

      return {
        ...mockResponse,
        usage: mockResponse.usage ?? {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          latencyMs: 0,
        },
      };
    }

    const startedAt = Date.now();
    const response = await this.getProvider().messages.create(
      {
        model: params.model,
        max_tokens: params.maxTokens,
        system: toSystemBlocks(params),
        messages: mapMessages(params),
        tools: mapTools(params),
        tool_choice: mapToolChoice(params),
        temperature: params.temperature,
      },
      {
        maxRetries: 0,
        timeout: DEFAULT_TIMEOUT_MS[params.feature],
      },
    );

    if ('content' in response === false) {
      throw new AIProviderError('Resposta em streaming nao e suportada por AiClient.invoke.');
    }

    const usage = toUsageMetrics(response, Date.now() - startedAt);
    const result = extractResult<T>(response);

    return {
      ...result,
      usage,
    };
  }

  async invoke<T>(params: AiClientInvokeParams): Promise<AiClientInvokeResult<T>> {
    const dbFeature = FEATURE_TO_DB_FEATURE[params.feature];
    const estimatedTokens = estimateTokens(params);

    try {
      await this.validateTenantAccess(params);
    } catch (error) {
      const errorCode = error instanceof Error ? error.name : 'AI_ACCESS_ERROR';

      await this.persistUsageLog({
        tenantId: params.tenantId,
        userId: params.userId,
        feature: dbFeature,
        model: params.model,
        status: AIUsageStatus.BLOCKED,
        errorCode,
      });

      throw error;
    }

    try {
      await checkAndReserveQuota(params.tenantId, estimatedTokens);
    } catch (error) {
      const errorCode = error instanceof Error ? error.name : 'AI_QUOTA_BLOCKED';

      await this.persistUsageLog({
        tenantId: params.tenantId,
        userId: params.userId,
        feature: dbFeature,
        model: params.model,
        status: AIUsageStatus.BLOCKED,
        errorCode,
      });

      throw error;
    }

    const cacheAllowed = shouldCacheAiResponse(params.messages);
    const cacheKey = cacheAllowed
      ? (params.cacheKey ??
        buildAiCacheKey(params.feature, {
          model: params.model,
          system: params.system,
          messages: params.messages,
          tools: params.tools,
        }))
      : null;

    if (cacheKey) {
      const cachedResponse = await getCachedAiResponse(cacheKey);

      if (cachedResponse) {
        const cached = JSON.parse(cachedResponse) as CachedInvokeResult;

        await this.persistUsageLog({
          tenantId: params.tenantId,
          userId: params.userId,
          feature: dbFeature,
          model: params.model,
          usage: cached.usage,
          status: AIUsageStatus.SUCCESS,
        });

        return {
          data: cached.data as T,
          usage: cached.usage,
          cacheHit: true,
          providerMessageId: cached.providerMessageId,
          stopReason: cached.stopReason,
          rawText: cached.rawText,
        };
      }
    }

    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const providerResponse = await this.invokeProvider<T>(params);
        const usage = providerResponse.usage;
        const costUsdMicros = computeCostUsdMicros(usage, params.model);

        await this.persistUsageLog({
          tenantId: params.tenantId,
          userId: params.userId,
          feature: dbFeature,
          model: params.model,
          usage,
          status: AIUsageStatus.SUCCESS,
        });

        await commitQuota(
          params.tenantId,
          (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
          costUsdMicros,
          estimatedTokens,
        );

        if (cacheKey) {
          await setCachedAiResponse(
            cacheKey,
            JSON.stringify({
              data: providerResponse.data,
              usage,
              providerMessageId: providerResponse.providerMessageId,
              stopReason: providerResponse.stopReason,
              rawText: providerResponse.rawText,
            } satisfies CachedInvokeResult),
            getAiCacheTtlSeconds(params.feature),
          );
        }

        return {
          ...providerResponse,
          usage,
          cacheHit: false,
        };
      } catch (error) {
        lastError = error;
        const retryDelayMs = getRetryDelayMs(error, attempt);

        if (retryDelayMs !== null && attempt < 2) {
          await sleep(retryDelayMs);
          continue;
        }

        await refundQuota(params.tenantId, estimatedTokens);

        const providerError =
          error instanceof AIProviderError
            ? error
            : error instanceof AIQuotaExceededError
              ? error
              : new AIProviderError(
                  error instanceof Error
                    ? error.message
                    : 'Falha desconhecida ao invocar o provider de IA.',
                  error instanceof Error ? error.name : 'AI_PROVIDER_ERROR',
                  error,
                );

        await this.persistUsageLog({
          tenantId: params.tenantId,
          userId: params.userId,
          feature: dbFeature,
          model: params.model,
          usage: {
            latencyMs: 0,
          },
          status: AIUsageStatus.ERROR,
          errorCode:
            providerError instanceof AIProviderError
              ? providerError.code
              : providerError instanceof Error
                ? providerError.name
                : 'AI_PROVIDER_ERROR',
        });

        throw providerError;
      }
    }

    // Inalcançável: o for-loop sempre retorna ou lança no catch.
    /* istanbul ignore next */
    throw new AIProviderError(
      lastError instanceof Error ? lastError.message : 'Falha ao invocar o provider de IA.',
      lastError instanceof Error ? lastError.name : 'AI_PROVIDER_ERROR',
      lastError,
    );
  }
}

export const aiClient = new AiClient();
