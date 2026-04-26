import { aiClient } from '../client';
import { AI_MODEL_HAIKU } from '../models';
import { redactPii } from '../pii-redactor';
import type { AiPromptBlock, AiToolDefinition, AiUsageMetrics } from '../types';

export type AssistantToolExecutor = (name: string, input: unknown) => Promise<unknown>;

export interface AssistantTurnParams {
  tenantId: string;
  userId: string;
  model: string;
  systemPrompt: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  userMessage: string;
  contextBlock?: { content: string; cacheable?: boolean };
  tools: AiToolDefinition[];
  toolExecutor: AssistantToolExecutor;
  maxTokens?: number;
  temperature?: number;
  maxToolIterations?: number;
}

export type AssistantStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool_use'; name: string; input: unknown }
  | { type: 'tool_result'; name: string; ok: boolean }
  | { type: 'done'; finalText: string; usage: AiUsageMetrics; iterations: number }
  | { type: 'error'; message: string; code?: string };

type AssistantToolUse = {
  id: string;
  name: string;
  input: unknown;
};

const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TEMPERATURE = 0.3;
const DEFAULT_MAX_TOOL_ITERATIONS = 3;
const ROUTING_MAX_TOKENS = 512;
const STREAM_CHUNK_SIZE = 24;
const STREAM_CHUNK_DELAY_MS = 8;
const MAX_TOOL_RESULT_CHARS = 12_000;

function emptyUsage(): Required<AiUsageMetrics> {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    latencyMs: 0,
  };
}

function addUsage(
  current: Required<AiUsageMetrics>,
  next: AiUsageMetrics | undefined,
): Required<AiUsageMetrics> {
  return {
    inputTokens: current.inputTokens + (next?.inputTokens ?? 0),
    outputTokens: current.outputTokens + (next?.outputTokens ?? 0),
    cacheReadTokens: current.cacheReadTokens + (next?.cacheReadTokens ?? 0),
    cacheCreationTokens: current.cacheCreationTokens + (next?.cacheCreationTokens ?? 0),
    latencyMs: current.latencyMs + (next?.latencyMs ?? 0),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isToolUse(value: unknown): value is AssistantToolUse {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['name'] === 'string' &&
    'input' in value
  );
}

function extractToolUses(data: unknown): AssistantToolUse[] {
  if (!isRecord(data)) {
    return [];
  }

  const toolUses = data['toolUses'];

  if (!Array.isArray(toolUses)) {
    return [];
  }

  return toolUses.filter(isToolUse);
}

function extractText(data: unknown, rawText?: string): string {
  if (typeof data === 'string') {
    return data;
  }

  if (isRecord(data) && typeof data['text'] === 'string') {
    return data['text'];
  }

  return rawText ?? '';
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit)}\n[conteudo_truncado]`;
}

function stringifyForPrompt(value: unknown): string {
  try {
    return truncate(JSON.stringify(value, null, 2), MAX_TOOL_RESULT_CHARS);
  } catch {
    return truncate(String(value), MAX_TOOL_RESULT_CHARS);
  }
}

function buildBaseMessages(params: AssistantTurnParams): AiPromptBlock[] {
  const messages: AiPromptBlock[] = [];

  if (params.contextBlock?.content) {
    messages.push({
      role: 'system',
      content: params.contextBlock.content,
      cacheable: params.contextBlock.cacheable !== false,
    });
  }

  for (const item of params.history) {
    messages.push({
      role: item.role,
      content: redactPii(item.content),
    });
  }

  messages.push({
    role: 'user',
    content: redactPii(params.userMessage),
  });

  return messages;
}

function buildRoutingSystemPrompt(systemPrompt: string): string {
  return `${systemPrompt}

# Etapa de roteamento
Decida se a pergunta precisa consultar dados operacionais. Se precisar, responda usando uma ou mais ferramentas disponíveis. Se não precisar, responda sem ferramenta com uma classificação curta como "chitChat" ou "offScope". Não entregue a resposta final ao usuário nesta etapa.`;
}

function buildFinalSystemPrompt(systemPrompt: string): string {
  return `${systemPrompt}

# Etapa final
Responda ao usuário usando apenas o histórico e os resultados de ferramentas já fornecidos. Não solicite novas ferramentas nesta etapa. Se os resultados não trouxerem o dado necessário, diga "Não tenho esse dado.".`;
}

function buildToolResultBlock(
  results: Array<{ name: string; ok: boolean; result: unknown }>,
): AiPromptBlock {
  return {
    role: 'tool',
    content: redactPii(
      stringifyForPrompt({
        toolResults: results,
      }),
    ),
  };
}

function* chunkText(text: string, size = STREAM_CHUNK_SIZE): Generator<string> {
  for (let index = 0; index < text.length; index += size) {
    yield text.slice(index, index + size);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toPublicErrorCode(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'AI_PROVIDER_ERROR';
  }

  const codeByName: Record<string, string> = {
    AIPlanRequiredError: 'PLAN_AI_REQUIRED',
    AIQuotaExceededError: 'AI_QUOTA_EXCEEDED',
    AIModelNotAllowedError: 'AI_MODEL_NOT_ALLOWED',
    AIConfigurationError: 'AI_CONFIGURATION_ERROR',
  };

  return codeByName[error.name] ?? error.name;
}

export class AssistantService {
  /**
   * Executa um turno do assistente com duas etapas:
   * 1. Haiku faz o roteamento e aciona tools whitelisted quando há necessidade de dados.
   * 2. Sonnet gera a resposta final; o texto é fatiado em eventos SSE `delta`.
   */
  async *streamTurn(params: AssistantTurnParams): AsyncGenerator<AssistantStreamEvent> {
    const maxTokens = params.maxTokens ?? DEFAULT_MAX_TOKENS;
    const temperature = params.temperature ?? DEFAULT_TEMPERATURE;
    const maxToolIterations = params.maxToolIterations ?? DEFAULT_MAX_TOOL_ITERATIONS;
    const messages = buildBaseMessages(params);
    let usage = emptyUsage();
    let iterations = 0;

    try {
      for (let index = 0; index < maxToolIterations; index += 1) {
        iterations = index + 1;
        const routingResult = await aiClient.invoke<unknown>({
          tenantId: params.tenantId,
          userId: params.userId,
          feature: 'chat',
          model: AI_MODEL_HAIKU,
          system: buildRoutingSystemPrompt(params.systemPrompt),
          messages,
          tools: params.tools,
          toolChoice: { type: 'auto' },
          maxTokens: ROUTING_MAX_TOKENS,
          temperature: 0,
        });

        usage = addUsage(usage, routingResult.usage);
        const toolUses = extractToolUses(routingResult.data);

        if (toolUses.length === 0) {
          break;
        }

        const toolResults: Array<{ name: string; ok: boolean; result: unknown }> = [];

        for (const toolUse of toolUses) {
          yield { type: 'tool_use', name: toolUse.name, input: toolUse.input };

          let ok = true;
          let result: unknown;

          try {
            result = await params.toolExecutor(toolUse.name, toolUse.input);
          } catch (error) {
            ok = false;
            result = {
              error: 'Falha na execução da ferramenta.',
              message: error instanceof Error ? error.message : String(error),
            };
          }

          toolResults.push({ name: toolUse.name, ok, result });
          yield { type: 'tool_result', name: toolUse.name, ok };
        }

        messages.push(buildToolResultBlock(toolResults));
      }

      const finalResult = await aiClient.invoke<unknown>({
        tenantId: params.tenantId,
        userId: params.userId,
        feature: 'chat',
        model: params.model,
        system: buildFinalSystemPrompt(params.systemPrompt),
        messages,
        toolChoice: { type: 'none' },
        maxTokens,
        temperature,
      });

      usage = addUsage(usage, finalResult.usage);

      const finalText =
        extractText(finalResult.data, finalResult.rawText).trim() || 'Não tenho esse dado.';

      for (const chunk of chunkText(finalText)) {
        yield { type: 'delta', text: chunk };

        if (STREAM_CHUNK_DELAY_MS > 0 && process.env.AI_MOCK !== 'true') {
          await sleep(STREAM_CHUNK_DELAY_MS);
        }
      }

      yield { type: 'done', finalText, usage, iterations };
    } catch (error) {
      yield {
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
        code: toPublicErrorCode(error),
      };
    }
  }
}

export const assistantService = new AssistantService();
