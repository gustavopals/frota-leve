import { prisma as prismaClient } from '../../../config/database';
import {
  evaluateDailyCostLimit,
  getTodayCostUsd,
  isAiDegraded,
  setAiDegraded,
} from './ai-cost-guard';
import { aiMetricsRegistry, recordAiCall } from './ai-metrics';

type MockPrisma = { aIUsageLog: { aggregate: jest.Mock } };

jest.mock('../../../config/database', () => ({
  prisma: { aIUsageLog: { aggregate: jest.fn() } },
}));

jest.mock('../../../config/env', () => ({
  env: { AI_DAILY_COST_USD_LIMIT: 50, NODE_ENV: 'test' },
}));

const prisma = prismaClient as unknown as MockPrisma;
const MICROS_PER_USD = 1_000_000;

describe('getTodayCostUsd', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('soma apenas o dia corrente em UTC', async () => {
    prisma.aIUsageLog.aggregate.mockResolvedValue({ _sum: { costUsdMicros: 12 * MICROS_PER_USD } });

    await expect(getTodayCostUsd(new Date('2026-08-03T18:00:00Z'))).resolves.toBe(12);

    const where = prisma.aIUsageLog.aggregate.mock.calls[0]?.[0]?.where;
    expect(where.createdAt.gte).toEqual(new Date('2026-08-03T00:00:00.000Z'));
  });

  it('devolve zero quando não houve chamada', async () => {
    prisma.aIUsageLog.aggregate.mockResolvedValue({ _sum: { costUsdMicros: null } });

    await expect(getTodayCostUsd()).resolves.toBe(0);
  });
});

describe('evaluateDailyCostLimit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setAiDegraded(false);
  });

  it('liga o modo degradado ao ultrapassar o limite', async () => {
    prisma.aIUsageLog.aggregate.mockResolvedValue({ _sum: { costUsdMicros: 60 * MICROS_PER_USD } });

    await expect(evaluateDailyCostLimit()).resolves.toMatchObject({
      costUsd: 60,
      limitUsd: 50,
      degraded: true,
    });
    expect(isAiDegraded()).toBe(true);
  });

  it('mantém desligado exatamente no limite', async () => {
    prisma.aIUsageLog.aggregate.mockResolvedValue({ _sum: { costUsdMicros: 50 * MICROS_PER_USD } });

    await expect(evaluateDailyCostLimit()).resolves.toMatchObject({ degraded: false });
  });

  it('desliga sozinho quando o gasto volta abaixo do limite', async () => {
    setAiDegraded(true);
    prisma.aIUsageLog.aggregate.mockResolvedValue({ _sum: { costUsdMicros: 1 * MICROS_PER_USD } });

    await evaluateDailyCostLimit();

    expect(isAiDegraded()).toBe(false);
  });
});

describe('recordAiCall', () => {
  it('publica as cinco séries de métrica', async () => {
    recordAiCall({
      feature: 'chat',
      model: 'claude-sonnet-5',
      status: 'SUCCESS',
      inputTokens: 100,
      outputTokens: 40,
      costUsdMicros: 1500,
      latencyMs: 820,
      cacheHit: true,
    });

    const output = await aiMetricsRegistry.metrics();

    expect(output).toContain('ai_requests_total');
    expect(output).toContain('ai_tokens_total');
    expect(output).toContain('ai_cost_usd_micros_total');
    expect(output).toContain('ai_latency_ms');
    expect(output).toContain('ai_cache_hits_total');
  });
});
