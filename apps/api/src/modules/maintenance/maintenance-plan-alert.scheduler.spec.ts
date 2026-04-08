import { MaintenanceType } from '@frota-leve/shared';
import { prisma as prismaClient } from '../../config/database';
import {
  MAINTENANCE_PLAN_ENTITY,
  MAINTENANCE_PLAN_OVERDUE_ACTION,
  MaintenancePlanAlertScheduler,
} from './maintenance-plan-alert.scheduler';

type MockMaintenancePlan = {
  id: string;
  tenantId: string;
  name: string;
  type: MaintenanceType;
  nextDueAt: Date | null;
  nextDueMileage: number | null;
  vehicle: {
    id: string;
    plate: string;
    currentMileage: number;
  };
};

type MockPrisma = {
  maintenancePlan: {
    findMany: jest.Mock;
  };
  auditLog: {
    findMany: jest.Mock;
    create: jest.Mock;
  };
};

jest.mock('../../config/database', () => ({
  prisma: {
    maintenancePlan: {
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

function createPlan(overrides: Partial<MockMaintenancePlan> = {}): MockMaintenancePlan {
  return {
    id: 'plan-1',
    tenantId: 'tenant-1',
    name: 'Troca de óleo',
    type: MaintenanceType.PREVENTIVE,
    nextDueAt: new Date('2026-04-07T10:00:00.000Z'),
    nextDueMileage: null,
    vehicle: {
      id: 'vehicle-1',
      plate: 'ABC1234',
      currentMileage: 50000,
    },
    ...overrides,
  };
}

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

describe('MaintenancePlanAlertScheduler', () => {
  beforeEach(() => {
    prisma.maintenancePlan.findMany.mockResolvedValue([]);
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.auditLog.create.mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('gera alerta para plano vencido por data', async () => {
    const scheduler = new MaintenancePlanAlertScheduler();
    const plan = createPlan();

    prisma.maintenancePlan.findMany.mockResolvedValue([plan]);

    const created = await scheduler.run(BASE_DATE);

    expect(created).toBe(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: plan.tenantId,
        action: MAINTENANCE_PLAN_OVERDUE_ACTION,
        entity: MAINTENANCE_PLAN_ENTITY,
        entityId: plan.id,
        userAgent: 'maintenance-plan-alert-scheduler',
        changes: expect.objectContaining({
          planName: plan.name,
          vehiclePlate: plan.vehicle.plate,
          reasons: ['date'],
        }),
      }),
    });
  });

  it('gera alerta para plano vencido por quilometragem', async () => {
    const scheduler = new MaintenancePlanAlertScheduler();
    const plan = createPlan({
      id: 'plan-2',
      nextDueAt: null,
      nextDueMileage: 45000,
      vehicle: {
        id: 'vehicle-2',
        plate: 'XYZ9876',
        currentMileage: 47000,
      },
    });

    prisma.maintenancePlan.findMany.mockResolvedValue([plan]);

    const created = await scheduler.run(BASE_DATE);

    expect(created).toBe(1);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        entityId: plan.id,
        changes: expect.objectContaining({
          nextDueMileage: 45000,
          currentMileage: 47000,
          reasons: ['mileage'],
        }),
      }),
    });
  });

  it('não gera alerta para plano ainda em dia', async () => {
    const scheduler = new MaintenancePlanAlertScheduler();
    const plan = createPlan({
      nextDueAt: new Date('2026-04-15T10:00:00.000Z'),
      nextDueMileage: 55000,
      vehicle: {
        id: 'vehicle-3',
        plate: 'DEF5678',
        currentMileage: 50000,
      },
    });

    prisma.maintenancePlan.findMany.mockResolvedValue([plan]);

    const created = await scheduler.run(BASE_DATE);

    expect(created).toBe(0);
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('não duplica alerta já gerado no mesmo dia', async () => {
    const scheduler = new MaintenancePlanAlertScheduler();
    const plan = createPlan({
      id: 'plan-4',
    });

    prisma.maintenancePlan.findMany.mockResolvedValue([plan]);
    prisma.auditLog.findMany.mockResolvedValue([{ entityId: plan.id }]);

    const created = await scheduler.run(BASE_DATE);

    expect(created).toBe(0);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        action: MAINTENANCE_PLAN_OVERDUE_ACTION,
        entity: MAINTENANCE_PLAN_ENTITY,
        entityId: {
          in: [plan.id],
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
