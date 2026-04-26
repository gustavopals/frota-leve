import type { Message } from '@anthropic-ai/sdk/resources/messages';

export type AiFeatureName = 'chat' | 'analysis' | 'report' | 'ocr' | 'anomaly' | 'scoring';

export interface AiUsageMetrics {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  latencyMs?: number;
}

export interface AiPromptBlock {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  cacheable?: boolean;
  containsFreshImage?: boolean;
}

export interface AiToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    [key: string]: unknown;
  };
}

export type AiToolChoice =
  | { type: 'auto'; disableParallelToolUse?: boolean }
  | { type: 'none' }
  | { type: 'tool'; name: string; disableParallelToolUse?: boolean };

export interface AiModelDefinition {
  id: string;
  label: string;
}

export interface AiClientInvokeParams {
  tenantId: string;
  userId?: string;
  feature: AiFeatureName;
  model: string;
  system: string;
  messages: AiPromptBlock[];
  tools?: AiToolDefinition[];
  toolChoice?: AiToolChoice;
  maxTokens: number;
  temperature?: number;
  cacheKey?: string;
}

export interface AiClientInvokeResult<T = unknown> {
  data: T;
  usage?: AiUsageMetrics;
  cacheHit?: boolean;
  providerMessageId?: string;
  stopReason?: Message['stop_reason'];
  rawText?: string;
}
