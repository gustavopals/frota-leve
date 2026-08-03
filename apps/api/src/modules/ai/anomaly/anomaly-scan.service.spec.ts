import { AIAnomalyKind, AIAnomalySeverity, AIAnomalyStatus, PlanType } from '@frota-leve/database';
import type { AnomalyFinding } from '@frota-leve/ai';
import { prisma as prismaClient } from '../../../config/database';
import {
  AnomalyScanService,
  buildCostPerKmSeries,
  buildFallbackMessage,
} from './anomaly-scan.service';

type MockPrisma = {
  fuelRecord: { findMany: jest.Mock };
  fine: { findMany: jest.Mock };
  vehicle: { findMany: jest.Mock };
  serviceOrder: { groupBy: jest.Mock; findMany: jest.Mock };
  tenant: { findMany: jest.Mock };
  aIAnomaly: { findFirst: jest.Mock; update: jest.Mock; create: jest.Mock };
};

jest.mock('../../../config/database', () => ({
  prisma: {
    fuelRecord: { findMany: jest.fn() },
    fine: { findMany: jest.fn() },
    vehicle: { findMany: jest.fn() },
    serviceOrder: { groupBy: jest.fn(), findMany: jest.fn() },
    tenant: { findMany: jest.fn() },
    aIAnomaly: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  },
}));

const prisma = prismaClient as unknown as MockPrisma;

const REFERENCE = new Date('2026-08-01T00:00:00.000Z');
const TENANT_ID = 'aaaaaaaa-0000-4000-a000-000000000001';
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(REFERENCE.getTime() - days * DAY_MS);
}

/** Tres multas do mesmo motorista disparam FINE_PATTERN de forma deterministica. */
function finesTriggeringPattern() {
  return [1, 2, 3].map((index) => ({
    id: `multa-${index}`,
    vehicleId: 'veiculo-1',
    driverId: 'motorista-1',
    location: `Local ${index}`,
    date: daysAgo(index),
  }));
}

function mockEmptyDataset(): void {
  prisma.fuelRecord.findMany.mockResolvedValue([]);
  prisma.fine.findMany.mockResolvedValue([]);
  prisma.vehicle.findMany.mockResolvedValue([]);
  prisma.serviceOrder.groupBy.mockResolvedValue([]);
  prisma.serviceOrder.findMany.mockResolvedValue([]);
}

describe('AnomalyScanService.scanTenant', () => {
  let service: AnomalyScanService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnomalyScanService();
    mockEmptyDataset();
    prisma.aIAnomaly.findFirst.mockResolvedValue(null);
    prisma.aIAnomaly.create.mockResolvedValue({});
    prisma.aIAnomaly.update.mockResolvedValue({});
  });

  it('nao cria nada quando nao ha anomalia', async () => {
    const result = await service.scanTenant(TENANT_ID, REFERENCE);

    expect(result).toMatchObject({ detected: 0, created: 0, refreshed: 0 });
    expect(prisma.aIAnomaly.create).not.toHaveBeenCalled();
  });

  it('cria a anomalia quando nao existe registro OPEN equivalente', async () => {
    prisma.fine.findMany.mockResolvedValue(finesTriggeringPattern());

    const result = await service.scanTenant(TENANT_ID, REFERENCE);

    expect(result.created).toBe(1);
    expect(result.refreshed).toBe(0);
    expect(prisma.aIAnomaly.create).toHaveBeenCalledTimes(1);

    const created = prisma.aIAnomaly.create.mock.calls[0]?.[0]?.data;
    expect(created).toMatchObject({
      tenantId: TENANT_ID,
      kind: AIAnomalyKind.FINE_PATTERN,
      entityType: 'driver',
      entityId: 'motorista-1',
      status: AIAnomalyStatus.OPEN,
      detectedAt: REFERENCE,
    });
    expect(created.message).toContain('3 multas');
  });

  it('atualiza em vez de duplicar quando ja existe uma anomalia OPEN igual', async () => {
    prisma.fine.findMany.mockResolvedValue(finesTriggeringPattern());
    prisma.aIAnomaly.findFirst.mockResolvedValue({ id: 'anomalia-existente' });

    const result = await service.scanTenant(TENANT_ID, REFERENCE);

    expect(result.created).toBe(0);
    expect(result.refreshed).toBe(1);
    expect(prisma.aIAnomaly.create).not.toHaveBeenCalled();
    expect(prisma.aIAnomaly.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'anomalia-existente' } }),
    );
  });

  it('deduplica por tenantId + kind + entityId considerando apenas status OPEN', async () => {
    prisma.fine.findMany.mockResolvedValue(finesTriggeringPattern());

    await service.scanTenant(TENANT_ID, REFERENCE);

    expect(prisma.aIAnomaly.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: TENANT_ID,
          kind: AIAnomalyKind.FINE_PATTERN,
          entityId: 'motorista-1',
          status: AIAnomalyStatus.OPEN,
        },
      }),
    );
  });

  it('escopa todas as consultas pelo tenant', async () => {
    await service.scanTenant(TENANT_ID, REFERENCE);

    for (const call of [
      prisma.fuelRecord.findMany.mock.calls[0]?.[0],
      prisma.fine.findMany.mock.calls[0]?.[0],
      prisma.vehicle.findMany.mock.calls[0]?.[0],
      prisma.serviceOrder.groupBy.mock.calls[0]?.[0],
    ]) {
      expect(call?.where).toMatchObject({ tenantId: TENANT_ID });
    }
  });
});

describe('AnomalyScanService.listScannableTenantIds', () => {
  it('devolve apenas tenants cujo plano habilita IA', async () => {
    jest.clearAllMocks();
    prisma.tenant.findMany.mockResolvedValue([
      { id: 'tenant-essential', plan: PlanType.ESSENTIAL },
      { id: 'tenant-pro', plan: PlanType.PROFESSIONAL },
      { id: 'tenant-ent', plan: PlanType.ENTERPRISE },
    ]);

    const ids = await new AnomalyScanService().listScannableTenantIds();

    expect(ids).toEqual(['tenant-pro', 'tenant-ent']);
  });
});

describe('buildCostPerKmSeries', () => {
  const WINDOW_START = new Date(Date.UTC(2026, 2, 1));

  it('usa a variacao do odometro do mes como quilometragem rodada', () => {
    const series = buildCostPerKmSeries(
      [
        { vehicleId: 'v1', date: new Date(Date.UTC(2026, 2, 5)), mileage: 1000, totalCost: 100 },
        { vehicleId: 'v1', date: new Date(Date.UTC(2026, 2, 25)), mileage: 2000, totalCost: 150 },
      ],
      [],
      WINDOW_START,
    );

    expect(series).toEqual([
      { vehicleId: 'v1', points: [{ monthIndex: 0, costPerKm: 250 / 1000 }] },
    ]);
  });

  it('soma o custo das ordens de servico no mes correspondente', () => {
    const series = buildCostPerKmSeries(
      [
        { vehicleId: 'v1', date: new Date(Date.UTC(2026, 2, 5)), mileage: 1000, totalCost: 100 },
        { vehicleId: 'v1', date: new Date(Date.UTC(2026, 2, 25)), mileage: 2000, totalCost: 100 },
      ],
      [{ vehicleId: 'v1', endDate: new Date(Date.UTC(2026, 2, 20)), totalCost: 300 }],
      WINDOW_START,
    );

    expect(series[0]?.points[0]?.costPerKm).toBe(500 / 1000);
  });

  it('descarta meses sem deslocamento medido em vez de dividir por zero', () => {
    const series = buildCostPerKmSeries(
      [{ vehicleId: 'v1', date: new Date(Date.UTC(2026, 2, 5)), mileage: 1000, totalCost: 100 }],
      [],
      WINDOW_START,
    );

    expect(series).toEqual([]);
  });

  it('ignora ordens de servico sem data de encerramento', () => {
    const series = buildCostPerKmSeries(
      [
        { vehicleId: 'v1', date: new Date(Date.UTC(2026, 2, 5)), mileage: 1000, totalCost: 100 },
        { vehicleId: 'v1', date: new Date(Date.UTC(2026, 2, 25)), mileage: 2000, totalCost: 100 },
      ],
      [{ vehicleId: 'v1', endDate: null, totalCost: 9999 }],
      WINDOW_START,
    );

    expect(series[0]?.points[0]?.costPerKm).toBe(200 / 1000);
  });
});

describe('buildFallbackMessage', () => {
  it('gera texto em pt-BR sem depender de IA', () => {
    const finding: AnomalyFinding = {
      kind: AIAnomalyKind.COST_PER_KM_TREND,
      severity: AIAnomalySeverity.HIGH,
      entityType: 'vehicle',
      entityId: 'veiculo-1',
      score: 0.12,
      evidence: { monthlyGrowthRate: 0.12, months: 6 },
    };

    expect(buildFallbackMessage(finding)).toBe(
      'Custo por km subindo 12.0% ao mês nos últimos 6 meses.',
    );
  });
});
