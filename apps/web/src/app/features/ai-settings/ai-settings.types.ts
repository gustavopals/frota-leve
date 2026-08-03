export type AiFeatureKey = 'chat' | 'anomalies' | 'reports' | 'ocr' | 'scoring';

export type AiFeatureFlags = Record<AiFeatureKey, boolean>;

export interface AiSettings {
  features: AiFeatureFlags;
  reportRecipients: string[];
  anomalyRecipients: string[];
}

export interface AiUsageByFeature {
  feature: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsdMicros: number;
}

export interface AiUsageOverview {
  currentMonth: AiUsageByFeature[];
  history: Array<{ period: string; costUsdMicros: number; tokens: number }>;
  circuitBreaker: { dailyCostLimitUsd: number; degraded: boolean };
}

export interface AiUsageLog {
  id: string;
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsdMicros: number;
  latencyMs: number;
  status: string;
  errorCode: string | null;
  createdAt: string;
}
