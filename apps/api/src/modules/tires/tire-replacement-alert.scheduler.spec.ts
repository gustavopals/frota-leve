import { prisma as prismaClient } from '../../config/database';
import {
  DEFAULT_TIRE_REPLACEMENT_THRESHOLD,
  TIRE_ENTITY,
  TIRE_REPLACEMENT_ALERT_ACTION,
  TIRE_REPLACEMENT_ALERT_SCHEDULER_USER_AGENT,
} from './tires.alerts';
import { TireReplacementAlertScheduler } from './tire-replacement-alert.scheduler';

type MockTire = {
  id: string;
  tenantId: string;
  serialNumber: string;
  brand: string;
  model: string;
  size: string;
  currentVehicleId: string | null;
  position: string | null;
  currentGrooveDepth: number;
  originalGrooveDepth: number;
  totalKm: number;
  currentVehicle: {
    id: string;
    plate: string;
    brand: string;
    model: string;
    year: number;
  } | null;
};

type MockPrisma = {
  tire: {
    findMany: jest.Mock;
  };
  auditLog: {
    findMany: jest.Mock;
    create: jest.Mock;
  };
};

jest.mock('../../config/database', () => ({
  prisma: {
    tire: {
      findMany: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

const prisma = prismaClient as unknown as MockPrisma;

const BASE_DATE = new Date('2026-04-08T10:00:00.000Z');

function createTire(overrides: Partial<MockTire> = {}): MockTire {
  return {
    id: 'tire-1',
    tenantId: 'tenant-1',
    serialNumber: 'PNEU-ALERTA-1',
    brand: 'Pirelli',
    model: 'Chrono',
    size: '195/65 R15',
    currentVehicleId: 'vehicle-1',
    position: 'Dianteiro esquerdo',
    currentGrooveDepth: 2.6,
    originalGrooveDepth: 8,
    totalKm: 42000,
    currentVehicle: {
      id: 'vehicle-1',
      plate: 'ABC1234',
      brand: 'Fiat',
      model: 'Strada',
      year: 2025,
    },
    ...overrides,
  };
}

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

describe('TireReplacementAlertScheduler', () => {
  beforeEach(() => {
    prisma.tire.findMany.mockResolvedValue([]);
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.create.mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('gera alerta para pneu abaixo do limite padrão', async () => {
    const scheduler = new TireReplacementAlertScheduler();
    const tire = createTire();

    prisma.tire.findMany.mockResolvedValue([tire]);

    const created = await scheduler.run(BASE_DATE);

    expect(created).toBe(1);
    expect(prisma.tire.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: 'IN_USE',
        currentGrooveDepth: { lt: DEFAULT_TIRE_REPLACEMENT_THRESHOLD },
      }),
      select: expect.any(Object),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: tire.tenantId,
        action: TIRE_REPLACEMENT_ALERT_ACTION,
        entity: TIRE_ENTITY,
        entityId: tire.id,
        userAgent: TIRE_REPLACEMENT_ALERT_SCHEDULER_USER_AGENT,
        changes: expect.objectContaining({
          serialNumber: tire.serialNumber,
          vehiclePlate: tire.currentVehicle?.plate,
          threshold: DEFAULT_TIRE_REPLACEMENT_THRESHOLD,
        }),
      }),
    });
  });

  it('respeita limite customizado na geração do alerta', async () => {
    const scheduler = new TireReplacementAlertScheduler();
    const tire = createTire({
      id: 'tire-2',
      currentGrooveDepth: 3.4,
    });

    prisma.tire.findMany.mockResolvedValue([tire]);

    const created = await scheduler.run(BASE_DATE, 3.5);

    expect(created).toBe(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        changes: expect.objectContaining({
          threshold: 3.5,
          mmBelowThreshold: 0.1,
        }),
      }),
    });
  });

  it('não duplica alerta do mesmo pneu no mesmo dia', async () => {
    const scheduler = new TireReplacementAlertScheduler();
    const tire = createTire();

    prisma.tire.findMany.mockResolvedValue([tire]);
    prisma.auditLog.findMany.mockResolvedValue([{ entityId: tire.id }]);

    const created = await scheduler.run(BASE_DATE);

    expect(created).toBe(0);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        action: TIRE_REPLACEMENT_ALERT_ACTION,
        entity: TIRE_ENTITY,
        entityId: {
          in: [tire.id],
        },
        createdAt: {
          gte: startOfDay(BASE_DATE),
        },
      },
      select: {
        entityId: true,
      },
    });
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
