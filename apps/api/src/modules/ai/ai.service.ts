import { prisma } from '../../config/database';
import { PLAN_LIMITS } from '@frota-leve/shared';
import type { PlanType as SharedPlanType } from '@frota-leve/shared';
import type {
  AIActorContext,
  AIQuotaSummary,
  AIUsageByFeature,
  AIUsageSummary,
  PeriodRange,
} from './ai.types';

const MICROS_PER_USD = 1_000_000;

/**
 * Converte um período `YYYY-MM` (ou o mês corrente, se omitido) em um intervalo
 * UTC `[start, end)` cobrindo o mês inteiro.
 */
function resolvePeriod(period?: string): PeriodRange {
  const now = new Date();
  let year: number;
  let month: number; // 1-12

  if (period) {
    const [yearStr, monthStr] = period.split('-');
    year = Number(yearStr);
    month = Number(monthStr);
  } else {
    year = now.getUTCFullYear();
    month = now.getUTCMonth() + 1;
  }

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const normalized = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}`;

  return { period: normalized, start, end };
}

function emptyTotals(): Omit<AIUsageByFeature, 'feature'> {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    totalTokens: 0,
    costUsdMicros: 0,
    costUsd: 0,
    requests: 0,
    errors: 0,
    blocked: 0,
  };
}

class AIService {
  async getUsage(context: AIActorContext, period?: string): Promise<AIUsageSummary> {
    const range = resolvePeriod(period);

    const logs = await prisma.aIUsageLog.findMany({
      where: {
        tenantId: context.tenantId,
        createdAt: { gte: range.start, lt: range.end },
      },
      select: {
        feature: true,
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        cacheCreationTokens: true,
        costUsdMicros: true,
        status: true,
      },
    });

    const byFeatureMap = new Map<string, AIUsageByFeature>();
    const totals = emptyTotals();

    for (const log of logs) {
      const featureKey = String(log.feature);
      const bucket =
        byFeatureMap.get(featureKey) ??
        ({ feature: featureKey, ...emptyTotals() } as AIUsageByFeature);

      bucket.inputTokens += log.inputTokens;
      bucket.outputTokens += log.outputTokens;
      bucket.cacheReadTokens += log.cacheReadTokens;
      bucket.cacheCreationTokens += log.cacheCreationTokens;
      bucket.costUsdMicros += log.costUsdMicros;
      bucket.requests += 1;

      if (log.status === 'ERROR') bucket.errors += 1;
      if (log.status === 'BLOCKED') bucket.blocked += 1;

      byFeatureMap.set(featureKey, bucket);

      totals.inputTokens += log.inputTokens;
      totals.outputTokens += log.outputTokens;
      totals.cacheReadTokens += log.cacheReadTokens;
      totals.cacheCreationTokens += log.cacheCreationTokens;
      totals.costUsdMicros += log.costUsdMicros;
      totals.requests += 1;
      if (log.status === 'ERROR') totals.errors += 1;
      if (log.status === 'BLOCKED') totals.blocked += 1;
    }

    const byFeature = Array.from(byFeatureMap.values()).map((entry) => {
      entry.totalTokens =
        entry.inputTokens + entry.outputTokens + entry.cacheReadTokens + entry.cacheCreationTokens;
      entry.costUsd = entry.costUsdMicros / MICROS_PER_USD;
      return entry;
    });

    totals.totalTokens =
      totals.inputTokens +
      totals.outputTokens +
      totals.cacheReadTokens +
      totals.cacheCreationTokens;
    totals.costUsd = totals.costUsdMicros / MICROS_PER_USD;

    byFeature.sort((a, b) => b.costUsdMicros - a.costUsdMicros);

    return {
      period: range.period,
      periodStart: range.start.toISOString(),
      periodEnd: range.end.toISOString(),
      totals,
      byFeature,
    };
  }

  async getQuota(context: AIActorContext): Promise<AIQuotaSummary> {
    const range = resolvePeriod();
    const planLimits = PLAN_LIMITS[context.tenantPlan as unknown as SharedPlanType];
    const planBudget = planLimits?.aiMonthlyTokenBudget ?? 0;

    const quota = await prisma.aITenantQuota.findUnique({
      where: { tenantId: context.tenantId },
    });

    // Considera vigente apenas se o período do registro cobre o mês corrente
    const isCurrent =
      quota &&
      quota.periodStart.getTime() <= range.start.getTime() &&
      quota.periodEnd.getTime() >= range.end.getTime();

    const tokenBudget = isCurrent ? quota.tokenBudget : planBudget;
    const tokensUsed = isCurrent ? quota.tokensUsed : 0;
    const costUsdMicros = isCurrent ? quota.costUsdMicros : 0;
    const blockedAt = isCurrent ? quota.blockedAt : null;

    return {
      period: range.period,
      periodStart: range.start.toISOString(),
      periodEnd: range.end.toISOString(),
      tokenBudget,
      tokensUsed,
      tokensRemaining: Math.max(0, tokenBudget - tokensUsed),
      costUsdMicros,
      costUsd: costUsdMicros / MICROS_PER_USD,
      blocked: Boolean(blockedAt),
      blockedAt: blockedAt ? blockedAt.toISOString() : null,
      resetsAt: range.end.toISOString(),
      plan: context.tenantPlan,
    };
  }
}

export const aiService = new AIService();
