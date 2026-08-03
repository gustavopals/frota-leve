import { MaintenanceType } from '@frota-leve/database';
import { scoringService as aiScoringService } from '@frota-leve/ai';
import { prisma as prismaClient } from '../../../config/database';
import { DriverScoringService } from './driver-scoring.service';

type MockPrisma = {
  driver: { findMany: jest.Mock; update: jest.Mock; count: jest.Mock };
  fuelRecord: { aggregate: jest.Mock; findMany: jest.Mock };
  fine: { findMany: jest.Mock };
  incident: { count: jest.Mock };
  checklistExecution: { count: jest.Mock };
  serviceOrder: { count: jest.Mock };
  driverScore: { findFirst: jest.Mock; upsert: jest.Mock; findMany: jest.Mock };
};

jest.mock('../../../config/database', () => ({
  prisma: {
    driver: { findMany: jest.fn(), update: jest.fn(), count: jest.fn() },
    fuelRecord: { aggregate: jest.fn(), findMany: jest.fn() },
    fine: { findMany: jest.fn() },
    incident: { count: jest.fn() },
    checklistExecution: { count: jest.fn() },
    serviceOrder: { count: jest.fn() },
    driverScore: { findFirst: jest.fn(), upsert: jest.fn(), findMany: jest.fn() },
  },
}));

jest.mock('@frota-leve/ai', () => {
  const actual = jest.requireActual('@frota-leve/ai');

  return {
    ...actual,
    scoringService: { recommend: jest.fn() },
  };
});

const prisma = prismaClient as unknown as MockPrisma;
const recommend = aiScoringService.recommend as unknown as jest.Mock;

const TENANT_ID = 'tenant-1';
const REFERENCE = new Date('2026-08-03T00:00:00.000Z');

function setupDriver(overrides: Record<string, unknown> = {}): void {
  prisma.driver.findMany.mockResolvedValue([{ id: 'motorista-1', name: 'Ana' }]);
  prisma.fuelRecord.aggregate.mockResolvedValue({ _avg: { kmPerLiter: 10 } });
  prisma.fuelRecord.findMany.mockResolvedValue([{ vehicleId: 'v1' }]);
  prisma.fine.findMany.mockResolvedValue([]);
  prisma.incident.count.mockResolvedValue(0);
  prisma.checklistExecution.count.mockResolvedValue(12);
  prisma.serviceOrder.count.mockResolvedValue(0);
  prisma.driverScore.findFirst.mockResolvedValue(null);
  prisma.driverScore.upsert.mockResolvedValue({});
  prisma.driver.update.mockResolvedValue({});
  Object.assign(prisma, overrides);
}

describe('DriverScoringService.scoreTenant', () => {
  let service: DriverScoringService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DriverScoringService();
    setupDriver();
    recommend.mockResolvedValue(null);
  });

  it('calcula e persiste o score do motorista', async () => {
    const results = await service.scoreTenant(TENANT_ID, REFERENCE);

    expect(results).toHaveLength(1);
    expect(prisma.driverScore.upsert).toHaveBeenCalled();
    expect(prisma.driver.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'motorista-1' } }),
    );
  });

  it('escopa todas as consultas pelo tenant', async () => {
    await service.scoreTenant(TENANT_ID, REFERENCE);

    expect(prisma.driver.findMany.mock.calls[0]?.[0]?.where).toMatchObject({
      tenantId: TENANT_ID,
      isActive: true,
    });
    expect(prisma.incident.count.mock.calls[0]?.[0]?.where).toMatchObject({ tenantId: TENANT_ID });
  });

  it('conta apenas manutenções corretivas no pilar de cuidado', async () => {
    await service.scoreTenant(TENANT_ID, REFERENCE);

    expect(prisma.serviceOrder.count.mock.calls[0]?.[0]?.where).toMatchObject({
      type: MaintenanceType.CORRECTIVE,
    });
  });

  it('pede recomendação na primeira avaliação', async () => {
    await service.scoreTenant(TENANT_ID, REFERENCE);

    expect(recommend).toHaveBeenCalled();
    expect(prisma.driverScore.upsert.mock.calls[0]?.[0]?.create.recommendations).toBe('');
  });

  it('não pede recomendação quando o score mudou menos de 5 pontos', async () => {
    // Score do cenário base é 94; anterior 93 => delta 1.
    prisma.driverScore.findFirst.mockResolvedValue({ score: 93 });

    await service.scoreTenant(TENANT_ID, REFERENCE);

    expect(recommend).not.toHaveBeenCalled();
  });

  it('persiste a recomendação quando a IA devolve dentro do contrato', async () => {
    recommend.mockResolvedValue({ strengths: ['ok'], improvements: [], actions: [] });

    await service.scoreTenant(TENANT_ID, REFERENCE);

    const created = prisma.driverScore.upsert.mock.calls[0]?.[0]?.create;
    expect(JSON.parse(created.recommendations)).toMatchObject({ strengths: ['ok'] });
  });

  it('não deixa falha em um motorista derrubar os demais', async () => {
    prisma.driver.findMany.mockResolvedValue([
      { id: 'motorista-1', name: 'Ana' },
      { id: 'motorista-2', name: 'Bruno' },
    ]);
    prisma.driverScore.upsert
      .mockRejectedValueOnce(new Error('conflito'))
      .mockResolvedValueOnce({});

    const results = await service.scoreTenant(TENANT_ID, REFERENCE);

    expect(results).toHaveLength(1);
    expect(results[0]?.driverId).toBe('motorista-2');
  });
});

describe('DriverScoringService.getRanking', () => {
  it('ordena por score e escopa por tenant', async () => {
    jest.clearAllMocks();
    prisma.driver.count.mockResolvedValue(2);
    prisma.driver.findMany.mockResolvedValue([]);

    const result = await new DriverScoringService().getRanking(TENANT_ID, { page: 1, limit: 10 });

    expect(prisma.driver.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { tenantId: TENANT_ID, isActive: true },
      orderBy: [{ score: 'desc' }, { name: 'asc' }],
    });
    expect(result.meta).toMatchObject({ total: 2, totalPages: 1 });
  });
});

describe('DriverScoringService.getHistory', () => {
  it('devolve o histórico mais recente do motorista', async () => {
    jest.clearAllMocks();
    prisma.driverScore.findMany.mockResolvedValue([]);

    await new DriverScoringService().getHistory(TENANT_ID, 'motorista-1');

    expect(prisma.driverScore.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { tenantId: TENANT_ID, driverId: 'motorista-1' },
      orderBy: { periodStart: 'desc' },
    });
  });
});
