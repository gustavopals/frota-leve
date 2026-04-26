import { executeAssistantTool, getAssistantToolDefinitions } from './index';

jest.mock('../../../config/database', () => {
  const aggregate = jest.fn().mockResolvedValue({
    _sum: { totalCost: 100, liters: 10, amount: 50 },
    _avg: { kmPerLiter: 8.5 },
    _count: { _all: 3 },
  });
  return {
    prisma: {
      vehicle: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'v1',
          plate: 'ABC1D23',
          brand: 'X',
          model: 'Y',
          year: 2020,
          category: 'LIGHT',
          fuelType: 'GASOLINE',
          status: 'ACTIVE',
          currentMileage: 1000,
          averageConsumption: 9,
          expectedConsumption: 10,
        }),
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([]),
      },
      driver: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      fuelRecord: {
        aggregate,
        groupBy: jest.fn().mockResolvedValue([]),
      },
      serviceOrder: {
        aggregate,
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      fine: { aggregate, count: jest.fn().mockResolvedValue(0) },
      incident: { count: jest.fn().mockResolvedValue(0) },
      aIAnomaly: { findMany: jest.fn().mockResolvedValue([]) },
    },
  };
});

const ctx = { tenantId: '00000000-0000-0000-0000-000000000001', userId: 'u1' };

describe('AI tools whitelist', () => {
  it('exposes the expected tool names', () => {
    const names = getAssistantToolDefinitions().map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'getVehicleById',
        'listVehiclesByFilter',
        'getMonthlySummary',
        'getTopCostVehicles',
        'getDriverMetrics',
        'listOpenAnomalies',
      ]),
    );
  });

  it('rejects an unknown tool name', async () => {
    const result = await executeAssistantTool('doesNotExist', {}, ctx);
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('validates input via Zod and returns details on invalid input', async () => {
    const result = await executeAssistantTool('getVehicleById', { vehicleId: 'not-uuid' }, ctx);
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it('executes getVehicleById by plate', async () => {
    const result = (await executeAssistantTool('getVehicleById', { plate: 'abc1d23' }, ctx)) as {
      found: boolean;
    };
    expect(result.found).toBe(true);
  });

  it('executes listVehiclesByFilter with default limit', async () => {
    const result = (await executeAssistantTool(
      'listVehiclesByFilter',
      { status: 'ACTIVE' },
      ctx,
    )) as { total: number; vehicles: unknown[] };
    expect(result.total).toBe(2);
    expect(result.vehicles).toEqual([]);
  });

  it('executes getMonthlySummary returning current + previous period', async () => {
    const result = (await executeAssistantTool('getMonthlySummary', {}, ctx)) as {
      period: string;
      previousPeriod: string;
      current: { totalCost: number };
    };
    expect(result.period).toMatch(/^\d{4}-\d{2}$/);
    expect(result.previousPeriod).toMatch(/^\d{4}-\d{2}$/);
    expect(typeof result.current.totalCost).toBe('number');
  });

  it('listOpenAnomalies returns an empty list when none exist', async () => {
    const result = (await executeAssistantTool('listOpenAnomalies', {}, ctx)) as {
      total: number;
      anomalies: unknown[];
    };
    expect(result.total).toBe(0);
    expect(result.anomalies).toEqual([]);
  });
});
