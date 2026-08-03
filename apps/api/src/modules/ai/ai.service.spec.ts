import { AIFeature, AIUsageStatus, PlanType } from '@frota-leve/database';
import { prisma as prismaClient } from '../../config/database';
import { aiService } from './ai.service';

type MockPrisma = {
  aIUsageLog: { findMany: jest.Mock };
  aITenantQuota: { findUnique: jest.Mock };
};

jest.mock('../../config/database', () => ({
  prisma: {
    aIUsageLog: { findMany: jest.fn() },
    aITenantQuota: { findUnique: jest.fn() },
  },
}));

const prisma = prismaClient as unknown as MockPrisma;

const CTX = {
  tenantId: 'tenant-1',
  tenantPlan: PlanType.PROFESSIONAL,
  userId: 'user-1',
};

function log(overrides: Record<string, unknown> = {}) {
  return {
    feature: AIFeature.CHAT,
    inputTokens: 100,
    outputTokens: 30,
    cacheReadTokens: 10,
    cacheCreationTokens: 5,
    costUsdMicros: 750,
    status: AIUsageStatus.SUCCESS,
    ...overrides,
  };
}

describe('aiService.getUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.aIUsageLog.findMany.mockResolvedValue([log(), log({ feature: AIFeature.OCR_FUEL })]);
  });

  it('escopa o consumo pelo tenant', async () => {
    await aiService.getUsage(CTX);

    expect(prisma.aIUsageLog.findMany.mock.calls[0]?.[0]?.where).toMatchObject({
      tenantId: CTX.tenantId,
    });
  });

  it('recorta o intervalo do período informado', async () => {
    await aiService.getUsage(CTX, '2026-07');

    const where = prisma.aIUsageLog.findMany.mock.calls[0]?.[0]?.where;
    expect(where.createdAt.gte).toEqual(new Date('2026-07-01T00:00:00.000Z'));
    expect(where.createdAt.lt).toEqual(new Date('2026-08-01T00:00:00.000Z'));
  });

  it('normaliza o período devolvido', async () => {
    await expect(aiService.getUsage(CTX, '2026-07')).resolves.toMatchObject({ period: '2026-07' });
  });

  it('usa o mês corrente quando o período é omitido', async () => {
    const result = await aiService.getUsage(CTX);

    expect(result.period).toMatch(/^\d{4}-\d{2}$/);
  });

  it('agrega os totais somando todos os logs', async () => {
    const result = await aiService.getUsage(CTX, '2026-07');

    expect(result.totals).toMatchObject({
      inputTokens: 200,
      outputTokens: 60,
      costUsdMicros: 1500,
    });
  });

  it('separa o consumo por feature', async () => {
    const result = await aiService.getUsage(CTX, '2026-07');

    expect(result.byFeature).toHaveLength(2);
    expect(result.byFeature.map((item) => item.feature)).toEqual(
      expect.arrayContaining([String(AIFeature.CHAT), String(AIFeature.OCR_FUEL)]),
    );
  });

  it('devolve zeros quando não há chamada no período', async () => {
    prisma.aIUsageLog.findMany.mockResolvedValue([]);

    const result = await aiService.getUsage(CTX, '2026-07');

    expect(result.totals.costUsdMicros).toBe(0);
    expect(result.byFeature).toEqual([]);
  });
});

describe('aiService.getQuota', () => {
  beforeEach(() => jest.clearAllMocks());

  it('usa o registro vigente quando o período cobre o mês corrente', async () => {
    const now = new Date();
    prisma.aITenantQuota.findUnique.mockResolvedValue({
      periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
      tokenBudget: 2_000_000,
      tokensUsed: 500_000,
      costUsdMicros: 1_000_000,
      blockedAt: null,
    });

    const result = await aiService.getQuota(CTX);

    expect(result).toMatchObject({
      tokenBudget: 2_000_000,
      tokensUsed: 500_000,
      tokensRemaining: 1_500_000,
      costUsd: 1,
      blocked: false,
    });
  });

  it('cai no orçamento do plano quando o registro é de outro período', async () => {
    prisma.aITenantQuota.findUnique.mockResolvedValue({
      periodStart: new Date('2020-01-01T00:00:00.000Z'),
      periodEnd: new Date('2020-02-01T00:00:00.000Z'),
      tokenBudget: 99,
      tokensUsed: 99,
      costUsdMicros: 1,
      blockedAt: new Date(),
    });

    const result = await aiService.getQuota(CTX);

    expect(result.tokensUsed).toBe(0);
    expect(result.blocked).toBe(false);
  });

  it('não quebra quando o tenant ainda não tem quota', async () => {
    prisma.aITenantQuota.findUnique.mockResolvedValue(null);

    await expect(aiService.getQuota(CTX)).resolves.toMatchObject({ tokensUsed: 0 });
  });

  it('marca bloqueio quando a quota vigente está bloqueada', async () => {
    const now = new Date();
    prisma.aITenantQuota.findUnique.mockResolvedValue({
      periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
      tokenBudget: 100,
      tokensUsed: 100,
      costUsdMicros: 0,
      blockedAt: new Date('2026-08-02T00:00:00.000Z'),
    });

    const result = await aiService.getQuota(CTX);

    expect(result.blocked).toBe(true);
    expect(result.tokensRemaining).toBe(0);
  });
});
