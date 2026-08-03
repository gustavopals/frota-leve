import type { PlanType } from '@frota-leve/database';

export interface AIActorContext {
  tenantId: string;
  tenantPlan: PlanType;
  userId: string;
}

export interface PeriodRange {
  /** YYYY-MM */
  period: string;
  start: Date;
  /** Exclusivo (próximo mês 00:00 UTC). */
  end: Date;
}

export interface AIUsageByFeature {
  feature: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalTokens: number;
  costUsdMicros: number;
  costUsd: number;
  requests: number;
  errors: number;
  blocked: number;
}

export interface AIUsageSummary {
  period: string;
  periodStart: string;
  periodEnd: string;
  totals: Omit<AIUsageByFeature, 'feature'>;
  byFeature: AIUsageByFeature[];
}

export interface AIQuotaSummary {
  period: string;
  periodStart: string;
  periodEnd: string;
  tokenBudget: number;
  tokensUsed: number;
  tokensRemaining: number;
  costUsdMicros: number;
  costUsd: number;
  blocked: boolean;
  blockedAt: string | null;
  resetsAt: string;
  plan: PlanType;
}
