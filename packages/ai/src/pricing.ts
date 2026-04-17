import { AI_MODEL_HAIKU, AI_MODEL_OPUS, AI_MODEL_SONNET } from './models';
import type { AiUsageMetrics } from './types';

export interface AiModelPricing {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  cacheReadUsdPerMillion: number;
  cacheCreationUsdPerMillion: number;
}

const USD_MICROS_PER_USD = 1_000_000;
const TOKENS_PER_MILLION = 1_000_000;

export const AI_MODEL_PRICING_TABLE: Record<string, AiModelPricing> = {
  [AI_MODEL_HAIKU]: {
    inputUsdPerMillion: 1,
    outputUsdPerMillion: 5,
    cacheReadUsdPerMillion: 0.1,
    cacheCreationUsdPerMillion: 1.25,
  },
  [AI_MODEL_SONNET]: {
    inputUsdPerMillion: 3,
    outputUsdPerMillion: 15,
    cacheReadUsdPerMillion: 0.3,
    cacheCreationUsdPerMillion: 3.75,
  },
  [AI_MODEL_OPUS]: {
    inputUsdPerMillion: 15,
    outputUsdPerMillion: 75,
    cacheReadUsdPerMillion: 1.5,
    cacheCreationUsdPerMillion: 18.75,
  },
};

export function getModelPricing(model: string): AiModelPricing | null {
  return AI_MODEL_PRICING_TABLE[model] ?? null;
}

export function computeCostUsdMicros(usage: AiUsageMetrics, model: string): number {
  const pricing = getModelPricing(model);

  if (!pricing) {
    return 0;
  }

  const totalUsd =
    ((usage.inputTokens ?? 0) * pricing.inputUsdPerMillion) / TOKENS_PER_MILLION +
    ((usage.outputTokens ?? 0) * pricing.outputUsdPerMillion) / TOKENS_PER_MILLION +
    ((usage.cacheReadTokens ?? 0) * pricing.cacheReadUsdPerMillion) / TOKENS_PER_MILLION +
    ((usage.cacheCreationTokens ?? 0) * pricing.cacheCreationUsdPerMillion) / TOKENS_PER_MILLION;

  return Math.round(totalUsd * USD_MICROS_PER_USD);
}
