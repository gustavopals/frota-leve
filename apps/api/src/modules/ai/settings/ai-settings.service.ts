import type { AIFeature } from '@frota-leve/database';
import { type Prisma } from '@frota-leve/database';
import { prisma } from '../../../config/database';
import { env } from '../../../config/env';
import { NotFoundError } from '../../../shared/errors';

/** Features que podem ser ligadas/desligadas por tenant (TASK 3.8.2). */
export const AI_TOGGLEABLE_FEATURES = ['chat', 'anomalies', 'reports', 'ocr', 'scoring'] as const;

export type AiToggleableFeature = (typeof AI_TOGGLEABLE_FEATURES)[number];

export type AiFeatureFlags = Record<AiToggleableFeature, boolean>;

export interface AiSettings {
  features: AiFeatureFlags;
  /** Vazio = usa todos os OWNER/ADMIN ativos do tenant. */
  reportRecipients: string[];
  anomalyRecipients: string[];
}

/** Default: tudo ligado, conforme o ROADMAP. */
export function defaultAiFeatures(): AiFeatureFlags {
  return Object.fromEntries(
    AI_TOGGLEABLE_FEATURES.map((feature) => [feature, true]),
  ) as AiFeatureFlags;
}

function readSettings(raw: Prisma.JsonValue | null): AiSettings {
  const settings = (raw ?? {}) as Record<string, unknown>;
  const ai = (settings['ai'] ?? {}) as Record<string, unknown>;
  const features = (ai['features'] ?? {}) as Record<string, unknown>;

  return {
    features: Object.fromEntries(
      AI_TOGGLEABLE_FEATURES.map((feature) => [feature, features[feature] !== false]),
    ) as AiFeatureFlags,
    reportRecipients: Array.isArray(ai['reportRecipients'])
      ? (ai['reportRecipients'] as string[])
      : [],
    anomalyRecipients: Array.isArray(ai['anomalyRecipients'])
      ? (ai['anomalyRecipients'] as string[])
      : [],
  };
}

export interface AiUsageLogQuery {
  feature?: AIFeature;
  status?: string;
  page: number;
  limit: number;
}

export class AiSettingsService {
  async get(tenantId: string): Promise<AiSettings> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant não encontrado');
    }

    return readSettings(tenant.settings);
  }

  /**
   * Grava as configurações de IA preservando o resto de `tenant.settings`.
   *
   * O campo é um JSON compartilhado por outros módulos, então a escrita precisa
   * ser um merge — sobrescrever o objeto inteiro apagaria configuração alheia.
   */
  async update(
    tenantId: string,
    patch: {
      features?: Partial<AiFeatureFlags>;
      reportRecipients?: string[];
      anomalyRecipients?: string[];
    },
  ): Promise<AiSettings> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant não encontrado');
    }

    const current = readSettings(tenant.settings);
    const merged: AiSettings = {
      features: { ...current.features, ...(patch.features ?? {}) },
      reportRecipients: patch.reportRecipients ?? current.reportRecipients,
      anomalyRecipients: patch.anomalyRecipients ?? current.anomalyRecipients,
    };

    const existing = (tenant.settings ?? {}) as Record<string, unknown>;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: { ...existing, ai: merged } as unknown as Prisma.InputJsonValue },
    });

    return merged;
  }

  /** Consultado antes de executar qualquer feature de IA (TASK 3.8.2). */
  async isFeatureEnabled(tenantId: string, feature: AiToggleableFeature): Promise<boolean> {
    const settings = await this.get(tenantId);

    return settings.features[feature];
  }

  /** Consumo do mês agregado por feature, com histórico de 6 meses (TASK 3.8.1). */
  async getUsageOverview(tenantId: string, reference = new Date()) {
    const monthStart = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
    const historyStart = new Date(
      Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - 5, 1),
    );

    const [byFeature, history] = await Promise.all([
      prisma.aIUsageLog.groupBy({
        by: ['feature'],
        where: { tenantId, createdAt: { gte: monthStart } },
        _sum: { inputTokens: true, outputTokens: true, costUsdMicros: true },
        _count: { _all: true },
      }),
      prisma.aIUsageLog.findMany({
        where: { tenantId, createdAt: { gte: historyStart } },
        select: { createdAt: true, costUsdMicros: true, inputTokens: true, outputTokens: true },
      }),
    ]);

    const monthly = new Map<string, { costUsdMicros: number; tokens: number }>();

    for (const entry of history) {
      const key = `${entry.createdAt.getUTCFullYear()}-${String(
        entry.createdAt.getUTCMonth() + 1,
      ).padStart(2, '0')}`;
      const bucket = monthly.get(key) ?? { costUsdMicros: 0, tokens: 0 };
      bucket.costUsdMicros += entry.costUsdMicros;
      bucket.tokens += entry.inputTokens + entry.outputTokens;
      monthly.set(key, bucket);
    }

    return {
      currentMonth: byFeature.map((row) => ({
        feature: row.feature,
        calls: row._count._all,
        inputTokens: row._sum.inputTokens ?? 0,
        outputTokens: row._sum.outputTokens ?? 0,
        costUsdMicros: row._sum.costUsdMicros ?? 0,
      })),
      history: [...monthly.entries()]
        .map(([period, value]) => ({ period, ...value }))
        .sort((a, b) => a.period.localeCompare(b.period)),
      circuitBreaker: {
        dailyCostLimitUsd: env.AI_DAILY_COST_USD_LIMIT,
        degraded: process.env['AI_DEGRADED'] === 'true',
      },
    };
  }

  /** Log de chamadas filtrável para auditoria (TASK 3.8.4). */
  async listUsageLogs(tenantId: string, query: AiUsageLogQuery) {
    const where: Prisma.AIUsageLogWhereInput = {
      tenantId,
      ...(query.feature ? { feature: query.feature } : {}),
      ...(query.status ? { status: query.status as Prisma.AIUsageLogWhereInput['status'] } : {}),
    };

    const [total, data] = await Promise.all([
      prisma.aIUsageLog.count({ where }),
      prisma.aIUsageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(Math.ceil(total / query.limit), 1),
      },
    };
  }
}

export const aiSettingsService = new AiSettingsService();
