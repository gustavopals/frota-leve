import jwt from 'jsonwebtoken';
import request from 'supertest';
import { PlanType, TenantStatus, UserRole, VehicleStatus } from '@frota-leve/database';
import { MaintenanceType } from '@frota-leve/shared';
import { createApp } from '../../app';
import { prisma as prismaClient } from '../../config/database';

type MockTenant = {
  id: string;
  name: string;
  plan: PlanType;
  status: TenantStatus;
  trialEndsAt: Date | null;
};

type MockUser = {
  id: string;
  tenantId: string;
  role: UserRole;
  email: string;
  isActive: boolean;
};

type MockVehicle = {
  id: string;
  tenantId: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  currentMileage: number;
  status: VehicleStatus;
};

type MockMaintenancePlan = {
  id: string;
  tenantId: string;
  vehicleId: string;
  name: string;
  type: MaintenanceType;
  intervalKm: number | null;
  intervalDays: number | null;
  lastExecutedAt: Date | null;
  lastExecutedMileage: number | null;
  nextDueAt: Date | null;
  nextDueMileage: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type MockMaintenancePlanWithRelations = MockMaintenancePlan & {
  vehicle: MockVehicle;
};

type MockServiceOrderStatsRecord = {
  vehicleId: string;
  type: MaintenanceType;
  status: 'OPEN' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  totalCost: number;
  laborCost: number | null;
  partsCost: number | null;
  vehicle: MockVehicle;
};

type MockTransactionClient = {
  maintenancePlan: {
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  auditLog: {
    create: jest.Mock;
    deleteMany: jest.Mock;
  };
};

type MockPrisma = {
  tenant: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock; findFirst: jest.Mock };
  vehicle: { findFirst: jest.Mock };
  serviceOrder: { findMany: jest.Mock };
  maintenancePlan: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    count: jest.Mock;
  };
  auditLog: {
    count: jest.Mock;
  };
  $transaction: jest.Mock;
};

jest.mock('../../config/database', () => ({
  prisma: {
    tenant: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    vehicle: { findFirst: jest.fn() },
    serviceOrder: { findMany: jest.fn() },
    maintenancePlan: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    auditLog: {
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const prisma = prismaClient as unknown as MockPrisma;

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

const TENANT: MockTenant = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  name: 'Tenant A',
  plan: PlanType.PROFESSIONAL,
  status: TenantStatus.ACTIVE,
  trialEndsAt: null,
};

const OWNER: MockUser = {
  id: 'bbbbbbbb-0000-0000-0000-000000000001',
  tenantId: TENANT.id,
  role: UserRole.OWNER,
  email: 'owner@a.com',
  isActive: true,
};

const VIEWER: MockUser = {
  id: 'bbbbbbbb-0000-0000-0000-000000000002',
  tenantId: TENANT.id,
  role: UserRole.VIEWER,
  email: 'viewer@a.com',
  isActive: true,
};

const VEHICLE: MockVehicle = {
  id: 'cccccccc-0000-0000-0000-000000000001',
  tenantId: TENANT.id,
  plate: 'ABC1234',
  brand: 'Toyota',
  model: 'Hilux',
  year: 2024,
  currentMileage: 55000,
  status: VehicleStatus.ACTIVE,
};

const MAINTENANCE_PLAN: MockMaintenancePlan = {
  id: 'dddddddd-0000-0000-0000-000000000001',
  tenantId: TENANT.id,
  vehicleId: VEHICLE.id,
  name: 'Troca de óleo',
  type: MaintenanceType.PREVENTIVE,
  intervalKm: 10000,
  intervalDays: 180,
  lastExecutedAt: new Date('2026-01-15T12:00:00.000Z'),
  lastExecutedMileage: 50000,
  nextDueAt: new Date('2026-07-14T12:00:00.000Z'),
  nextDueMileage: 60000,
  isActive: true,
  createdAt: new Date('2026-04-01T10:00:00.000Z'),
  updatedAt: new Date('2026-04-01T10:00:00.000Z'),
};

const MAINTENANCE_PLAN_WITH_RELATIONS: MockMaintenancePlanWithRelations = {
  ...MAINTENANCE_PLAN,
  vehicle: VEHICLE,
};

const BASE_PAYLOAD = {
  vehicleId: VEHICLE.id,
  name: 'Troca de óleo',
  type: MaintenanceType.PREVENTIVE,
  intervalKm: 10000,
  intervalDays: 180,
  lastExecutedAt: '2026-01-15T12:00:00.000Z',
  lastExecutedMileage: 50000,
  isActive: true,
};

function makeToken(user: MockUser) {
  return jwt.sign(
    {
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      type: 'access',
    },
    process.env['JWT_SECRET'] ?? 'test-secret',
    {
      subject: user.id,
      expiresIn: '1h',
      jwtid: 'maintenance-access-token',
    },
  );
}

function setupDefaultMocks() {
  prisma.tenant.findUnique.mockResolvedValue(TENANT);
  prisma.user.findUnique.mockResolvedValue(OWNER);
  prisma.user.findFirst.mockResolvedValue(OWNER);
  prisma.vehicle.findFirst.mockResolvedValue(VEHICLE);
  prisma.serviceOrder.findMany.mockResolvedValue([]);
  prisma.maintenancePlan.findMany.mockResolvedValue([MAINTENANCE_PLAN_WITH_RELATIONS]);
  prisma.maintenancePlan.findFirst.mockResolvedValue(MAINTENANCE_PLAN_WITH_RELATIONS);
  prisma.maintenancePlan.count.mockResolvedValue(1);
  prisma.auditLog.count.mockResolvedValue(1);
}

describe('Maintenance E2E', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it('GET /maintenance/plans returns paginated list', async () => {
    const res = await request(app)
      .get('/api/v1/maintenance/plans')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      id: MAINTENANCE_PLAN.id,
      vehicleId: VEHICLE.id,
      isOverdue: false,
    });
    expect(res.body.meta).toMatchObject({ page: 1, total: 1 });
  });

  it('GET /maintenance/alerts returns overdue and upcoming plans summary', async () => {
    const overdueByDatePlan = {
      ...MAINTENANCE_PLAN_WITH_RELATIONS,
      id: 'dddddddd-0000-0000-0000-000000000002',
      nextDueAt: new Date('2026-04-01T10:00:00.000Z'),
      nextDueMileage: 65000,
    };
    const upcomingByMileagePlan = {
      ...MAINTENANCE_PLAN_WITH_RELATIONS,
      id: 'dddddddd-0000-0000-0000-000000000003',
      nextDueAt: new Date('2026-06-01T10:00:00.000Z'),
      nextDueMileage: 55700,
      vehicle: {
        ...VEHICLE,
        currentMileage: 55000,
      },
    };
    const unrelatedPlan = {
      ...MAINTENANCE_PLAN_WITH_RELATIONS,
      id: 'dddddddd-0000-0000-0000-000000000004',
      nextDueAt: new Date('2026-12-01T10:00:00.000Z'),
      nextDueMileage: 70000,
    };

    prisma.maintenancePlan.findMany.mockResolvedValue([
      overdueByDatePlan,
      upcomingByMileagePlan,
      unrelatedPlan,
    ]);

    const res = await request(app)
      .get('/api/v1/maintenance/alerts')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({
      overdue: 1,
      upcoming: 1,
      total: 2,
      daysAhead: 30,
      kmAhead: 1000,
    });
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({
      id: overdueByDatePlan.id,
      alertType: 'overdue',
      dueReasons: ['date'],
    });
    expect(res.body.items[1]).toMatchObject({
      id: upcomingByMileagePlan.id,
      alertType: 'upcoming',
      dueReasons: ['mileage'],
    });
  });

  it('GET /maintenance/alerts filters by vehicle and custom thresholds', async () => {
    const anotherVehiclePlan = {
      ...MAINTENANCE_PLAN_WITH_RELATIONS,
      id: 'dddddddd-0000-0000-0000-000000000005',
      vehicleId: 'cccccccc-0000-0000-0000-000000000009',
      vehicle: {
        ...VEHICLE,
        id: 'cccccccc-0000-0000-0000-000000000009',
        plate: 'XYZ9999',
      },
      nextDueAt: new Date('2026-04-20T10:00:00.000Z'),
      nextDueMileage: 56000,
    };
    const targetVehicleUpcoming = {
      ...MAINTENANCE_PLAN_WITH_RELATIONS,
      id: 'dddddddd-0000-0000-0000-000000000006',
      nextDueAt: daysFromNow(5),
      nextDueMileage: 58000,
    };

    prisma.maintenancePlan.findMany.mockResolvedValue([anotherVehiclePlan, targetVehicleUpcoming]);

    const res = await request(app)
      .get(`/api/v1/maintenance/alerts?vehicleId=${VEHICLE.id}&daysAhead=10&kmAhead=4000`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(prisma.maintenancePlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT.id,
          vehicleId: VEHICLE.id,
        }),
      }),
    );
    expect(res.body.summary).toMatchObject({
      overdue: 0,
      upcoming: 1,
      total: 1,
      daysAhead: 10,
      kmAhead: 4000,
    });
  });

  it('GET /maintenance/stats returns MTTR and MTBF by vehicle', async () => {
    const anotherVehicle: MockVehicle = {
      ...VEHICLE,
      id: 'cccccccc-0000-0000-0000-000000000009',
      plate: 'XYZ9999',
      brand: 'Volvo',
      model: 'FH',
      year: 2022,
      currentMileage: 210000,
    };

    const reliabilityOrders: MockServiceOrderStatsRecord[] = [
      {
        vehicleId: VEHICLE.id,
        type: MaintenanceType.CORRECTIVE,
        status: 'COMPLETED',
        startDate: new Date('2026-04-01T08:00:00.000Z'),
        endDate: new Date('2026-04-01T12:00:00.000Z'),
        createdAt: new Date('2026-04-01T08:00:00.000Z'),
        totalCost: 100,
        laborCost: 40,
        partsCost: 60,
        vehicle: VEHICLE,
      },
      {
        vehicleId: VEHICLE.id,
        type: MaintenanceType.CORRECTIVE,
        status: 'COMPLETED',
        startDate: new Date('2026-04-03T08:00:00.000Z'),
        endDate: new Date('2026-04-03T10:00:00.000Z'),
        createdAt: new Date('2026-04-03T08:00:00.000Z'),
        totalCost: 150,
        laborCost: 50,
        partsCost: 100,
        vehicle: VEHICLE,
      },
      {
        vehicleId: VEHICLE.id,
        type: MaintenanceType.CORRECTIVE,
        status: 'COMPLETED',
        startDate: new Date('2026-04-06T08:00:00.000Z'),
        endDate: new Date('2026-04-06T14:00:00.000Z'),
        createdAt: new Date('2026-04-06T08:00:00.000Z'),
        totalCost: 250,
        laborCost: 100,
        partsCost: 150,
        vehicle: VEHICLE,
      },
      {
        vehicleId: anotherVehicle.id,
        type: MaintenanceType.CORRECTIVE,
        status: 'COMPLETED',
        startDate: new Date('2026-04-02T07:00:00.000Z'),
        endDate: new Date('2026-04-02T15:00:00.000Z'),
        createdAt: new Date('2026-04-02T07:00:00.000Z'),
        totalCost: 300,
        laborCost: 120,
        partsCost: 180,
        vehicle: anotherVehicle,
      },
    ];

    const costOrders: MockServiceOrderStatsRecord[] = [
      ...reliabilityOrders,
      {
        vehicleId: VEHICLE.id,
        type: MaintenanceType.PREVENTIVE,
        status: 'APPROVED',
        startDate: null,
        endDate: null,
        createdAt: new Date('2026-04-05T09:00:00.000Z'),
        totalCost: 120,
        laborCost: 20,
        partsCost: 100,
        vehicle: VEHICLE,
      },
      {
        vehicleId: anotherVehicle.id,
        type: MaintenanceType.PREDICTIVE,
        status: 'OPEN',
        startDate: null,
        endDate: null,
        createdAt: new Date('2026-04-07T09:30:00.000Z'),
        totalCost: 90,
        laborCost: 30,
        partsCost: 60,
        vehicle: anotherVehicle,
      },
    ];

    prisma.serviceOrder.findMany
      .mockResolvedValueOnce(reliabilityOrders)
      .mockResolvedValueOnce(costOrders);

    const res = await request(app)
      .get('/api/v1/maintenance/stats')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.reliability.summary).toMatchObject({
      totalVehicles: 2,
      totalCorrectiveOrders: 4,
      vehiclesWithMtbf: 1,
      averageMttrHours: 5,
      averageMtbfHours: 57,
      totalDowntimeHours: 20,
      totalOperatingHours: 114,
      dateFrom: null,
      dateTo: null,
    });
    expect(res.body.reliability.items).toHaveLength(2);
    expect(res.body.reliability.items[0]).toMatchObject({
      vehicle: {
        id: VEHICLE.id,
        plate: VEHICLE.plate,
      },
      correctiveOrders: 3,
      totalDowntimeHours: 12,
      totalOperatingHours: 114,
      mttrHours: 4,
      mtbfHours: 57,
    });
    expect(res.body.reliability.items[1]).toMatchObject({
      vehicle: {
        id: anotherVehicle.id,
        plate: anotherVehicle.plate,
      },
      correctiveOrders: 1,
      totalDowntimeHours: 8,
      totalOperatingHours: null,
      mttrHours: 8,
      mtbfHours: null,
    });
    expect(res.body.costs.summary).toMatchObject({
      totalOrders: 6,
      totalCost: 1010,
      laborCost: 360,
      partsCost: 650,
      averageOrderCost: 168.33,
      preventiveCost: 120,
      correctiveCost: 800,
      predictiveCost: 90,
      granularity: 'day',
      dateFrom: null,
      dateTo: null,
    });
    expect(res.body.costs.byType).toMatchObject({
      preventive: {
        totalOrders: 1,
        totalCost: 120,
      },
      corrective: {
        totalOrders: 4,
        totalCost: 800,
      },
      predictive: {
        totalOrders: 1,
        totalCost: 90,
      },
    });
    expect(res.body.costs.byVehicle[0]).toMatchObject({
      vehicle: {
        id: VEHICLE.id,
      },
      totalOrders: 4,
      totalCost: 620,
      preventiveCost: 120,
      correctiveCost: 500,
      predictiveCost: 0,
    });
    expect(res.body.costs.byVehicle[1]).toMatchObject({
      vehicle: {
        id: anotherVehicle.id,
      },
      totalOrders: 2,
      totalCost: 390,
      preventiveCost: 0,
      correctiveCost: 300,
      predictiveCost: 90,
    });
    expect(res.body.costs.byPeriod).toEqual([
      expect.objectContaining({
        period: '2026-04-01',
        totalOrders: 1,
        totalCost: 100,
        correctiveCost: 100,
      }),
      expect.objectContaining({
        period: '2026-04-02',
        totalOrders: 1,
        totalCost: 300,
        correctiveCost: 300,
      }),
      expect.objectContaining({
        period: '2026-04-03',
        totalOrders: 1,
        totalCost: 150,
        correctiveCost: 150,
      }),
      expect.objectContaining({
        period: '2026-04-05',
        totalOrders: 1,
        totalCost: 120,
        preventiveCost: 120,
      }),
      expect.objectContaining({
        period: '2026-04-06',
        totalOrders: 1,
        totalCost: 250,
        correctiveCost: 250,
      }),
      expect.objectContaining({
        period: '2026-04-07',
        totalOrders: 1,
        totalCost: 90,
        predictiveCost: 90,
      }),
    ]);
  });

  it('GET /maintenance/stats filters by vehicle and completion period', async () => {
    const reliabilityOrders: MockServiceOrderStatsRecord[] = [
      {
        vehicleId: VEHICLE.id,
        type: MaintenanceType.CORRECTIVE,
        status: 'COMPLETED',
        startDate: new Date('2026-04-10T08:00:00.000Z'),
        endDate: new Date('2026-04-10T13:00:00.000Z'),
        createdAt: new Date('2026-04-10T07:30:00.000Z'),
        totalCost: 200,
        laborCost: 80,
        partsCost: 120,
        vehicle: VEHICLE,
      },
    ];
    const costOrders: MockServiceOrderStatsRecord[] = [
      ...reliabilityOrders,
      {
        vehicleId: VEHICLE.id,
        type: MaintenanceType.PREVENTIVE,
        status: 'OPEN',
        startDate: null,
        endDate: null,
        createdAt: new Date('2026-04-12T10:00:00.000Z'),
        totalCost: 60,
        laborCost: 10,
        partsCost: 50,
        vehicle: VEHICLE,
      },
    ];

    prisma.serviceOrder.findMany
      .mockResolvedValueOnce(reliabilityOrders)
      .mockResolvedValueOnce(costOrders);

    const res = await request(app)
      .get(
        `/api/v1/maintenance/stats?vehicleId=${VEHICLE.id}&dateFrom=2026-04-01&dateTo=2026-04-30`,
      )
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(prisma.serviceOrder.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT.id,
          vehicleId: VEHICLE.id,
          type: 'CORRECTIVE',
          status: 'COMPLETED',
          startDate: { not: null },
          endDate: expect.objectContaining({
            not: null,
            gte: new Date('2026-04-01T00:00:00.000Z'),
            lte: new Date('2026-04-30T00:00:00.000Z'),
          }),
        }),
      }),
    );
    expect(prisma.serviceOrder.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT.id,
          vehicleId: VEHICLE.id,
          status: {
            not: 'CANCELLED',
          },
          createdAt: expect.objectContaining({
            gte: new Date('2026-04-01T00:00:00.000Z'),
            lte: new Date('2026-04-30T00:00:00.000Z'),
          }),
        }),
      }),
    );
    expect(res.body.reliability.summary).toMatchObject({
      totalVehicles: 1,
      totalCorrectiveOrders: 1,
      vehiclesWithMtbf: 0,
      averageMttrHours: 5,
      averageMtbfHours: null,
      totalDowntimeHours: 5,
      totalOperatingHours: 0,
    });
    expect(res.body.costs.summary).toMatchObject({
      totalOrders: 2,
      totalCost: 260,
      laborCost: 90,
      partsCost: 170,
      averageOrderCost: 130,
      preventiveCost: 60,
      correctiveCost: 200,
      predictiveCost: 0,
      granularity: 'day',
    });
  });

  it('GET /maintenance/plans/:id returns single plan', async () => {
    const res = await request(app)
      .get(`/api/v1/maintenance/plans/${MAINTENANCE_PLAN.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(MAINTENANCE_PLAN.id);
    expect(res.body.vehicle.plate).toBe(VEHICLE.plate);
  });

  it('POST /maintenance/plans creates a plan and computes next due values', async () => {
    const txMock: MockTransactionClient = {
      maintenancePlan: {
        create: jest
          .fn()
          .mockImplementation(
            (args: {
              data: typeof BASE_PAYLOAD & { nextDueAt: Date | null; nextDueMileage: number | null };
            }) =>
              Promise.resolve({
                ...MAINTENANCE_PLAN_WITH_RELATIONS,
                ...args.data,
                vehicle: VEHICLE,
              }),
          ),
        update: jest.fn(),
        delete: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation((fn: (tx: MockTransactionClient) => Promise<unknown>) =>
      fn(txMock),
    );

    const res = await request(app)
      .post('/api/v1/maintenance/plans')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.nextDueMileage).toBe(60000);
    expect(res.body.nextDueAt).toBeTruthy();
    expect(txMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'MAINTENANCE_PLAN_CREATED',
        }),
      }),
    );
  });

  it('POST /maintenance/plans returns 400 when no schedule is informed', async () => {
    const res = await request(app)
      .post('/api/v1/maintenance/plans')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({
        vehicleId: VEHICLE.id,
        name: 'Troca de óleo',
        type: MaintenanceType.PREVENTIVE,
      });

    expect(res.status).toBe(400);
  });

  it('POST /maintenance/plans returns 403 for VIEWER role', async () => {
    prisma.user.findUnique.mockResolvedValue(VIEWER);
    prisma.user.findFirst.mockResolvedValue(VIEWER);

    const res = await request(app)
      .post('/api/v1/maintenance/plans')
      .set('Authorization', `Bearer ${makeToken(VIEWER)}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(403);
  });

  it('PUT /maintenance/plans/:id updates plan', async () => {
    const txMock: MockTransactionClient = {
      maintenancePlan: {
        create: jest.fn(),
        update: jest
          .fn()
          .mockImplementation((args: { data: { isActive: boolean; intervalKm: number | null } }) =>
            Promise.resolve({
              ...MAINTENANCE_PLAN_WITH_RELATIONS,
              ...args.data,
              vehicle: VEHICLE,
            }),
          ),
        delete: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation((fn: (tx: MockTransactionClient) => Promise<unknown>) =>
      fn(txMock),
    );

    const res = await request(app)
      .put(`/api/v1/maintenance/plans/${MAINTENANCE_PLAN.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({ ...BASE_PAYLOAD, intervalKm: 12000 });

    expect(res.status).toBe(200);
    expect(txMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'MAINTENANCE_PLAN_UPDATED',
        }),
      }),
    );
  });

  it('DELETE /maintenance/plans/:id soft deletes plan when it already has history', async () => {
    prisma.auditLog.count.mockResolvedValue(3);

    const txMock: MockTransactionClient = {
      maintenancePlan: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          ...MAINTENANCE_PLAN_WITH_RELATIONS,
          isActive: false,
        }),
        delete: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation((fn: (tx: MockTransactionClient) => Promise<unknown>) =>
      fn(txMock),
    );

    const res = await request(app)
      .delete(`/api/v1/maintenance/plans/${MAINTENANCE_PLAN.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      deleted: true,
      mode: 'soft',
      maintenancePlanId: MAINTENANCE_PLAN.id,
    });
    expect(txMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'MAINTENANCE_PLAN_DELETED',
        }),
      }),
    );
  });
});
