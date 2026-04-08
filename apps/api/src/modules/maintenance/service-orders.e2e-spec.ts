import jwt from 'jsonwebtoken';
import request from 'supertest';
import { PlanType, TenantStatus, UserRole, VehicleStatus } from '@frota-leve/database';
import { MaintenanceType, ServiceOrderStatus } from '@frota-leve/shared';
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

type MockDriver = {
  id: string;
  tenantId: string;
  name: string;
  cpf: string;
};

type MockMaintenancePlan = {
  id: string;
  tenantId: string;
  vehicleId: string;
  name: string;
  type: MaintenanceType;
  intervalKm: number | null;
  intervalDays: number | null;
};

type MockServiceOrderItem = {
  id: string;
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  partNumber: string | null;
};

type MockServiceOrder = {
  id: string;
  tenantId: string;
  vehicleId: string;
  driverId: string | null;
  planId: string | null;
  type: MaintenanceType;
  status: ServiceOrderStatus;
  description: string;
  workshop: string | null;
  startDate: Date | null;
  endDate: Date | null;
  totalCost: number;
  laborCost: number | null;
  partsCost: number | null;
  notes: string | null;
  photos: string[];
  approvedByUserId: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  vehicle: MockVehicle;
  driver: MockDriver | null;
  plan: MockMaintenancePlan | null;
  approvedByUser: { id: string; name: string; email: string } | null;
  createdByUser: { id: string; name: string; email: string } | null;
  items: MockServiceOrderItem[];
};

type MockTransactionClient = {
  serviceOrder: {
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  maintenancePlan: {
    update: jest.Mock;
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
  driver: { findFirst: jest.Mock };
  maintenancePlan: { findFirst: jest.Mock };
  serviceOrder: {
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
    driver: { findFirst: jest.fn() },
    maintenancePlan: { findFirst: jest.fn() },
    serviceOrder: {
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

const TENANT: MockTenant = {
  id: 'aaaaaaaa-1111-1111-1111-111111111111',
  name: 'Tenant SO',
  plan: PlanType.PROFESSIONAL,
  status: TenantStatus.ACTIVE,
  trialEndsAt: null,
};

const OWNER: MockUser = {
  id: 'bbbbbbbb-1111-1111-1111-111111111111',
  tenantId: TENANT.id,
  role: UserRole.OWNER,
  email: 'owner@tenant.com',
  isActive: true,
};

const VIEWER: MockUser = {
  id: 'bbbbbbbb-1111-1111-1111-111111111112',
  tenantId: TENANT.id,
  role: UserRole.VIEWER,
  email: 'viewer@tenant.com',
  isActive: true,
};

const VEHICLE: MockVehicle = {
  id: 'cccccccc-1111-1111-1111-111111111111',
  tenantId: TENANT.id,
  plate: 'ABC1234',
  brand: 'Toyota',
  model: 'Hilux',
  year: 2024,
  currentMileage: 62000,
  status: VehicleStatus.ACTIVE,
};

const DRIVER: MockDriver = {
  id: 'dddddddd-1111-1111-1111-111111111111',
  tenantId: TENANT.id,
  name: 'João Silva',
  cpf: '12345678901',
};

const PLAN: MockMaintenancePlan = {
  id: 'eeeeeeee-1111-1111-1111-111111111111',
  tenantId: TENANT.id,
  vehicleId: VEHICLE.id,
  name: 'Troca de óleo',
  type: MaintenanceType.PREVENTIVE,
  intervalKm: 10000,
  intervalDays: 180,
};

const ITEM: MockServiceOrderItem = {
  id: 'ffffffff-1111-1111-1111-111111111111',
  description: 'Filtro de óleo',
  quantity: 1,
  unitCost: 80,
  totalCost: 80,
  partNumber: 'FO-123',
};

const SERVICE_ORDER: MockServiceOrder = {
  id: '99999999-1111-1111-1111-111111111111',
  tenantId: TENANT.id,
  vehicleId: VEHICLE.id,
  driverId: DRIVER.id,
  planId: PLAN.id,
  type: MaintenanceType.PREVENTIVE,
  status: ServiceOrderStatus.OPEN,
  description: 'Troca completa de óleo e filtro',
  workshop: 'Oficina Centro',
  startDate: null,
  endDate: null,
  totalCost: 260,
  laborCost: 180,
  partsCost: 80,
  notes: 'Prioridade alta',
  photos: ['https://example.com/photo-1.jpg'],
  approvedByUserId: null,
  createdByUserId: OWNER.id,
  createdAt: new Date('2026-04-08T10:00:00.000Z'),
  updatedAt: new Date('2026-04-08T10:00:00.000Z'),
  vehicle: VEHICLE,
  driver: DRIVER,
  plan: PLAN,
  approvedByUser: null,
  createdByUser: {
    id: OWNER.id,
    name: 'Owner',
    email: OWNER.email,
  },
  items: [ITEM],
};

const BASE_PAYLOAD = {
  vehicleId: VEHICLE.id,
  driverId: DRIVER.id,
  planId: PLAN.id,
  type: MaintenanceType.PREVENTIVE,
  description: 'Troca completa de óleo e filtro',
  workshop: 'Oficina Centro',
  laborCost: 180,
  notes: 'Prioridade alta',
  photos: ['https://example.com/photo-1.jpg'],
  items: [
    {
      description: 'Filtro de óleo',
      quantity: 1,
      unitCost: 80,
      partNumber: 'FO-123',
    },
  ],
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
      jwtid: 'service-order-access-token',
    },
  );
}

function setupDefaultMocks() {
  prisma.tenant.findUnique.mockResolvedValue(TENANT);
  prisma.user.findUnique.mockResolvedValue(OWNER);
  prisma.user.findFirst.mockResolvedValue(OWNER);
  prisma.vehicle.findFirst.mockResolvedValue(VEHICLE);
  prisma.driver.findFirst.mockResolvedValue(DRIVER);
  prisma.maintenancePlan.findFirst.mockResolvedValue(PLAN);
  prisma.serviceOrder.findMany.mockResolvedValue([SERVICE_ORDER]);
  prisma.serviceOrder.findFirst.mockResolvedValue(SERVICE_ORDER);
  prisma.serviceOrder.count.mockResolvedValue(1);
  prisma.auditLog.count.mockResolvedValue(1);
}

describe('ServiceOrders E2E', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it('GET /maintenance/service-orders returns paginated list', async () => {
    const res = await request(app)
      .get('/api/v1/maintenance/service-orders')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      id: SERVICE_ORDER.id,
      status: ServiceOrderStatus.OPEN,
      vehicleId: VEHICLE.id,
    });
  });

  it('POST /maintenance/service-orders creates a service order', async () => {
    const txMock: MockTransactionClient = {
      serviceOrder: {
        create: jest
          .fn()
          .mockImplementation(
            (args: {
              data: {
                totalCost: number;
                partsCost: number;
                laborCost: number;
                createdByUserId: string | null;
              };
            }) =>
              Promise.resolve({
                ...SERVICE_ORDER,
                totalCost: args.data.totalCost,
                partsCost: args.data.partsCost,
                laborCost: args.data.laborCost,
                createdByUserId: args.data.createdByUserId,
              }),
          ),
        update: jest.fn(),
        delete: jest.fn(),
      },
      maintenancePlan: {
        update: jest.fn(),
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
      .post('/api/v1/maintenance/service-orders')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(ServiceOrderStatus.OPEN);
    expect(res.body.totalCost).toBe(260);
    expect(res.body.items).toHaveLength(1);
    expect(txMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'SERVICE_ORDER_CREATED',
        }),
      }),
    );
  });

  it('POST /maintenance/service-orders returns 403 for VIEWER role', async () => {
    prisma.user.findUnique.mockResolvedValue(VIEWER);
    prisma.user.findFirst.mockResolvedValue(VIEWER);

    const res = await request(app)
      .post('/api/v1/maintenance/service-orders')
      .set('Authorization', `Bearer ${makeToken(VIEWER)}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(403);
  });

  it('PUT /maintenance/service-orders/:id approves an open order', async () => {
    const txMock: MockTransactionClient = {
      serviceOrder: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          ...SERVICE_ORDER,
          status: ServiceOrderStatus.APPROVED,
          approvedByUserId: OWNER.id,
          approvedByUser: {
            id: OWNER.id,
            name: 'Owner',
            email: OWNER.email,
          },
        }),
        delete: jest.fn(),
      },
      maintenancePlan: {
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTransactionClient) => Promise<unknown>) =>
      fn(txMock),
    );
    prisma.serviceOrder.findFirst.mockResolvedValue(SERVICE_ORDER);

    const res = await request(app)
      .put(`/api/v1/maintenance/service-orders/${SERVICE_ORDER.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({
        ...BASE_PAYLOAD,
        status: ServiceOrderStatus.APPROVED,
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(ServiceOrderStatus.APPROVED);
    expect(txMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'SERVICE_ORDER_UPDATED',
        }),
      }),
    );
  });

  it('PUT /maintenance/service-orders/:id rejects invalid transition APPROVED -> COMPLETED', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValue({
      ...SERVICE_ORDER,
      status: ServiceOrderStatus.APPROVED,
      approvedByUserId: OWNER.id,
    });

    const res = await request(app)
      .put(`/api/v1/maintenance/service-orders/${SERVICE_ORDER.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({
        ...BASE_PAYLOAD,
        status: ServiceOrderStatus.COMPLETED,
        startDate: '2026-04-08T09:00:00.000Z',
        endDate: '2026-04-08T11:00:00.000Z',
      });

    expect(res.status).toBe(400);
  });

  it('PUT /maintenance/service-orders/:id moves APPROVED -> IN_PROGRESS', async () => {
    const currentApproved = {
      ...SERVICE_ORDER,
      status: ServiceOrderStatus.APPROVED,
      approvedByUserId: OWNER.id,
    };
    const txMock: MockTransactionClient = {
      serviceOrder: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          ...currentApproved,
          status: ServiceOrderStatus.IN_PROGRESS,
          startDate: new Date('2026-04-08T12:00:00.000Z'),
        }),
        delete: jest.fn(),
      },
      maintenancePlan: {
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTransactionClient) => Promise<unknown>) =>
      fn(txMock),
    );
    prisma.serviceOrder.findFirst.mockResolvedValue(currentApproved);

    const res = await request(app)
      .put(`/api/v1/maintenance/service-orders/${SERVICE_ORDER.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({
        ...BASE_PAYLOAD,
        status: ServiceOrderStatus.IN_PROGRESS,
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(ServiceOrderStatus.IN_PROGRESS);
    expect(res.body.startDate).toBeTruthy();
  });

  it('PUT /maintenance/service-orders/:id moves IN_PROGRESS -> COMPLETED and updates linked plan', async () => {
    const currentInProgress = {
      ...SERVICE_ORDER,
      status: ServiceOrderStatus.IN_PROGRESS,
      approvedByUserId: OWNER.id,
      startDate: new Date('2026-04-08T12:00:00.000Z'),
    };
    const txMock: MockTransactionClient = {
      serviceOrder: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          ...currentInProgress,
          status: ServiceOrderStatus.COMPLETED,
          endDate: new Date('2026-04-08T14:30:00.000Z'),
        }),
        delete: jest.fn(),
      },
      maintenancePlan: {
        update: jest.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTransactionClient) => Promise<unknown>) =>
      fn(txMock),
    );
    prisma.serviceOrder.findFirst.mockResolvedValue(currentInProgress);

    const res = await request(app)
      .put(`/api/v1/maintenance/service-orders/${SERVICE_ORDER.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({
        ...BASE_PAYLOAD,
        status: ServiceOrderStatus.COMPLETED,
        endDate: '2026-04-08T14:30:00.000Z',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(ServiceOrderStatus.COMPLETED);
    expect(txMock.maintenancePlan.update).toHaveBeenCalled();
  });

  it('DELETE /maintenance/service-orders/:id cancels an open order when it already has history', async () => {
    prisma.auditLog.count.mockResolvedValue(3);
    const txMock: MockTransactionClient = {
      serviceOrder: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          ...SERVICE_ORDER,
          status: ServiceOrderStatus.CANCELLED,
        }),
        delete: jest.fn(),
      },
      maintenancePlan: {
        update: jest.fn(),
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
      .delete(`/api/v1/maintenance/service-orders/${SERVICE_ORDER.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      deleted: true,
      mode: 'soft',
      serviceOrderId: SERVICE_ORDER.id,
    });
  });
});
