import type { AiModelDefinition } from './types';

export const AI_MODEL_HAIKU = 'claude-haiku-4-5-20251001';
export const AI_MODEL_SONNET = 'claude-sonnet-4-6';
export const AI_MODEL_OPUS = 'claude-opus-4-7';

export const AI_MODELS: readonly AiModelDefinition[] = [
  { id: AI_MODEL_HAIKU, label: 'Claude Haiku 4.5' },
  { id: AI_MODEL_SONNET, label: 'Claude Sonnet 4.6' },
  { id: AI_MODEL_OPUS, label: 'Claude Opus 4.7' },
] as const;
