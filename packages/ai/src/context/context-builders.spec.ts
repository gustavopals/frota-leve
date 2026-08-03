import { prisma } from '@frota-leve/database';
import { buildFleetCatalogContext } from './fleet-catalog';
import {
  buildMonthlyAggregates,
  previousPeriod,
  resolvePeriodRange,
} from './monthly-aggregates';

jest.mock('@frota-leve/database', () => {
  const actual = jest.requireActual('@frota-leve/database');

  return {
    ...actual,
    prisma: {
      tenant: { findUnique: jest.fn() },
      vehicle: { count: jest.fn(), groupBy: jest.fn(), findMany: jest.fn() },
      driver: { count: jest.fn() },
      serviceOrder: {
        count: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
        aggregate: jest.fn(),
      },
      fuelRecord: { groupBy: jest.fn(), findMany: jest.fn(), aggregate: jest.fn() },
      fine: { findMany: jest.fn(), aggregate: jest.fn() },
      aIAnomaly: { count: jest.fn(), findMany: jest.fn() },
    },
  };
});

const prismaMock = prisma as unknown as Record<string, Record<string, jest.Mock>>;

/** Acesso ao mock sem non-null assertion (proibida pelo ESLint do projeto). */
function mockOf(model: string, method: string): jest.Mock {
  const target = prismaMock[model]?.[method];

  if (!target) {
    throw new Error(`Mock ausente: ${model}.${method}`);
  }

  return target;
}
const TENANT_ID = 'tenant-1';

describe('resolvePeriodRange', () => {
  it('converte YYYY-MM em intervalo UTC semiaberto', () => {
    expect(resolvePeriodRange('2026-07')).toEqual({
      start: new Date('2026-07-01T00:00:00.000Z'),
      end: new Date('2026-08-01T00:00:00.000Z'),
    });
  });

  it('vira o ano corretamente em dezembro', () => {
    expect(resolvePeriodRange('2026-12').end).toEqual(new Date('2027-01-01T00:00:00.000Z'));
  });

  it('recusa período malformado', () => {
    expect(() => resolvePeriodRange('2026-13')).toThrow(/Período inválido/);
    expect(() => resolvePeriodRange('julho')).toThrow(/Período inválido/);
  });
});

describe('previousPeriod', () => {
  it('volta um mês', () => {
    expect(previousPeriod('2026-07')).toBe('2026-06');
  });

  it('volta o ano em janeiro', () => {
    expect(previousPeriod('2026-01')).toBe('2025-12');
  });
});

describe('buildFleetCatalogContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOf('tenant', 'findUnique').mockResolvedValue({ name: 'Empresa', plan: 'PROFESSIONAL' });
    mockOf('vehicle', 'count').mockResolvedValue(12);
    mockOf('vehicle', 'groupBy').mockResolvedValue([]);
    mockOf('vehicle', 'findMany').mockResolvedValue([]);
    mockOf('driver', 'count').mockResolvedValue(8);
    mockOf('serviceOrder', 'count').mockResolvedValue(3);
    mockOf('serviceOrder', 'groupBy').mockResolvedValue([]);
    mockOf('fuelRecord', 'groupBy').mockResolvedValue([]);
    mockOf('aIAnomaly', 'count').mockResolvedValue(2);
  });

  it('devolve JSON serializável com os totais da frota', async () => {
    const context = await buildFleetCatalogContext(TENANT_ID);
    const parsed = JSON.parse(context) as Record<string, unknown>;

    expect(typeof context).toBe('string');
    expect(parsed).toBeTruthy();
  });

  it('escopa todas as consultas pelo tenant', async () => {
    await buildFleetCatalogContext(TENANT_ID);

    const calls = [
      mockOf('vehicle', 'count').mock.calls[0]?.[0],
      mockOf('driver', 'count').mock.calls[0]?.[0],
      mockOf('aIAnomaly', 'count').mock.calls[0]?.[0],
    ];

    for (const call of calls) {
      expect(call?.where).toMatchObject({ tenantId: TENANT_ID });
    }
  });
});

describe('buildMonthlyAggregates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOf('vehicle', 'findMany').mockResolvedValue([
      { id: 'v1', plate: 'ABC1D23', category: 'LIGHT', year: 2020 },
    ]);
    mockOf('fuelRecord', 'findMany').mockResolvedValue([
      { vehicleId: 'v1', liters: 50, totalCost: 400, mileage: 1000, kmPerLiter: 9 },
      { vehicleId: 'v1', liters: 40, totalCost: 320, mileage: 2000, kmPerLiter: 11 },
    ]);
    mockOf('fuelRecord', 'aggregate').mockResolvedValue({ _sum: { totalCost: 0 } });
    mockOf('serviceOrder', 'findMany').mockResolvedValue([
      { vehicleId: 'v1', totalCost: 1000 },
    ]);
    mockOf('serviceOrder', 'count').mockResolvedValue(2);
    mockOf('serviceOrder', 'aggregate').mockResolvedValue({ _sum: { totalCost: 0 } });
    mockOf('fine', 'findMany').mockResolvedValue([
      { vehicleId: 'v1', amount: 200, points: 5 },
    ]);
    mockOf('fine', 'aggregate').mockResolvedValue({ _sum: { amount: 0 } });
    mockOf('aIAnomaly', 'findMany').mockResolvedValue([]);
  });

  it('soma as três fontes de custo', async () => {
    const data = await buildMonthlyAggregates(TENANT_ID, '2026-07');

    // 720 combustível + 1000 manutenção + 200 multa
    expect(data.totalCost).toBe(1920);
  });

  it('calcula custo/km pela variação do odômetro', async () => {
    const data = await buildMonthlyAggregates(TENANT_ID, '2026-07');

    expect(data.topVehiclesByCostPerKm[0]).toMatchObject({
      plate: 'ABC1D23',
      distanceKm: 1000,
      costPerKm: 1.92,
    });
  });

  it('agrega o consumo médio e o desvio', async () => {
    const data = await buildMonthlyAggregates(TENANT_ID, '2026-07');

    expect(data.fuel.averageKmPerLiter).toBe(10);
    expect(data.fuel.kmPerLiterStdDev).toBeGreaterThan(0);
  });

  it('deixa a comparação nula sem base do mês anterior', async () => {
    const data = await buildMonthlyAggregates(TENANT_ID, '2026-07');

    expect(data.comparison).toMatchObject({
      previousPeriod: '2026-06',
      previousTotalCost: 0,
      totalCostChangeRate: null,
    });
  });

  it('escopa as consultas pelo tenant', async () => {
    await buildMonthlyAggregates(TENANT_ID, '2026-07');

    expect(mockOf('vehicle', 'findMany').mock.calls[0]?.[0]?.where).toMatchObject({
      tenantId: TENANT_ID,
    });
    expect(mockOf('fine', 'findMany').mock.calls[0]?.[0]?.where).toMatchObject({
      tenantId: TENANT_ID,
    });
  });
});
