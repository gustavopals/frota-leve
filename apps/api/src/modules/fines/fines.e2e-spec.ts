import jwt from 'jsonwebtoken';
import request from 'supertest';
import { PlanType, TenantStatus, UserRole, VehicleStatus } from '@frota-leve/database';
import { FineSeverity, FineStatus } from '@frota-leve/shared';
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

type MockFine = {
  id: string;
  tenantId: string;
  vehicleId: string;
  driverId: string | null;
  date: Date;
  autoNumber: string;
  location: string;
  description: string;
  severity: FineSeverity;
  points: number;
  amount: number;
  discountAmount: number | null;
  dueDate: Date;
  status: FineStatus;
  payrollDeduction: boolean;
  notes: string | null;
  fileUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  vehicle: MockVehicle;
  driver: MockDriver | null;
};

type MockPrisma = {
  tenant: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock; findFirst: jest.Mock };
  vehicle: { findFirst: jest.Mock };
  driver: { findFirst: jest.Mock };
  fine: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    count: jest.Mock;
  };
  auditLog: { count: jest.Mock };
  $transaction: jest.Mock;
};

jest.mock('../../config/database', () => ({
  prisma: {
    tenant: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    vehicle: { findFirst: jest.fn() },
    driver: { findFirst: jest.fn() },
    fine: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    auditLog: { count: jest.fn() },
    $transaction: jest.fn(),
  },
}));

const prisma = prismaClient as unknown as MockPrisma;

const TENANT: MockTenant = {
  id: 'aaaaaaaa-2222-2222-2222-222222222222',
  name: 'Tenant Fines',
  plan: PlanType.PROFESSIONAL,
  status: TenantStatus.ACTIVE,
  trialEndsAt: null,
};

const OWNER: MockUser = {
  id: 'bbbbbbbb-2222-2222-2222-222222222221',
  tenantId: TENANT.id,
  role: UserRole.OWNER,
  email: 'owner@fines.com',
  isActive: true,
};

const VIEWER: MockUser = {
  id: 'bbbbbbbb-2222-2222-2222-222222222222',
  tenantId: TENANT.id,
  role: UserRole.VIEWER,
  email: 'viewer@fines.com',
  isActive: true,
};

const VEHICLE: MockVehicle = {
  id: 'cccccccc-2222-2222-2222-222222222222',
  tenantId: TENANT.id,
  plate: 'XYZ9A90',
  brand: 'Ford',
  model: 'Ranger',
  year: 2023,
  currentMileage: 45000,
  status: VehicleStatus.ACTIVE,
};

const DRIVER: MockDriver = {
  id: 'dddddddd-2222-2222-2222-222222222222',
  tenantId: TENANT.id,
  name: 'Carlos Pereira',
  cpf: '98765432100',
};

const FINE: MockFine = {
  id: 'eeeeeeee-2222-2222-2222-222222222222',
  tenantId: TENANT.id,
  vehicleId: VEHICLE.id,
  driverId: null,
  date: new Date('2026-04-01T10:00:00.000Z'),
  autoNumber: 'SP-2026-00123',
  location: 'Av. Paulista, 1000 - São Paulo/SP',
  description: 'Excesso de velocidade - 20% acima do limite',
  severity: FineSeverity.SERIOUS,
  points: 5,
  amount: 195.23,
  discountAmount: 136.66,
  dueDate: new Date('2026-05-01T00:00:00.000Z'),
  status: FineStatus.PENDING,
  payrollDeduction: false,
  notes: null,
  fileUrl: null,
  createdAt: new Date('2026-04-08T10:00:00.000Z'),
  updatedAt: new Date('2026-04-08T10:00:00.000Z'),
  vehicle: VEHICLE,
  driver: null,
};

const BASE_PAYLOAD = {
  vehicleId: VEHICLE.id,
  date: '2026-04-01T10:00:00.000Z',
  autoNumber: 'SP-2026-00123',
  location: 'Av. Paulista, 1000 - São Paulo/SP',
  description: 'Excesso de velocidade - 20% acima do limite',
  severity: FineSeverity.SERIOUS,
  points: 5,
  amount: 195.23,
  discountAmount: 136.66,
  dueDate: '2026-05-01T00:00:00.000Z',
  payrollDeduction: false,
};

function makeToken(user: MockUser) {
  return jwt.sign(
    { tenantId: user.tenantId, role: user.role, email: user.email, type: 'access' },
    process.env['JWT_SECRET'] ?? 'test-secret',
    { subject: user.id, expiresIn: '1h', jwtid: 'fines-access-token' },
  );
}

function setupDefaultMocks() {
  prisma.tenant.findUnique.mockResolvedValue(TENANT);
  prisma.user.findUnique.mockResolvedValue(OWNER);
  prisma.user.findFirst.mockResolvedValue(OWNER);
  prisma.vehicle.findFirst.mockResolvedValue(VEHICLE);
  prisma.driver.findFirst.mockResolvedValue(DRIVER);
  prisma.fine.findMany.mockResolvedValue([FINE]);
  prisma.fine.findFirst.mockResolvedValue(FINE);
  prisma.fine.count.mockResolvedValue(1);
  prisma.auditLog.count.mockResolvedValue(1);
}

type MockTxClient = {
  fine: { create: jest.Mock; update: jest.Mock; delete: jest.Mock };
  auditLog: { create: jest.Mock; deleteMany: jest.Mock };
};

describe('Fines E2E', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it('GET /fines returns paginated list', async () => {
    const res = await request(app)
      .get('/api/v1/fines')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      id: FINE.id,
      status: FineStatus.PENDING,
      vehicleId: VEHICLE.id,
    });
    expect(res.body.meta).toMatchObject({ page: 1, total: 1 });
  });

  it('GET /fines/:id returns a fine', async () => {
    const res = await request(app)
      .get(`/api/v1/fines/${FINE.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(FINE.id);
    expect(res.body.autoNumber).toBe(FINE.autoNumber);
  });

  it('POST /fines creates a fine with PENDING status', async () => {
    const txMock: MockTxClient = {
      fine: {
        create: jest.fn().mockResolvedValue(FINE),
        update: jest.fn(),
        delete: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTxClient) => Promise<unknown>) =>
      fn(txMock),
    );

    const res = await request(app)
      .post('/api/v1/fines')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(FineStatus.PENDING);
    expect(txMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'FINE_CREATED' }),
      }),
    );
  });

  it('POST /fines returns 403 for VIEWER role', async () => {
    prisma.user.findUnique.mockResolvedValue(VIEWER);
    prisma.user.findFirst.mockResolvedValue(VIEWER);

    const res = await request(app)
      .post('/api/v1/fines')
      .set('Authorization', `Bearer ${makeToken(VIEWER)}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(403);
  });

  it('PUT /fines/:id transitions PENDING -> DRIVER_IDENTIFIED', async () => {
    const identified = {
      ...FINE,
      driverId: DRIVER.id,
      status: FineStatus.DRIVER_IDENTIFIED,
      driver: DRIVER,
    };
    const txMock: MockTxClient = {
      fine: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(identified),
        delete: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTxClient) => Promise<unknown>) =>
      fn(txMock),
    );

    const res = await request(app)
      .put(`/api/v1/fines/${FINE.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({ ...BASE_PAYLOAD, driverId: DRIVER.id, status: FineStatus.DRIVER_IDENTIFIED });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(FineStatus.DRIVER_IDENTIFIED);
    expect(res.body.driverId).toBe(DRIVER.id);
  });

  it('PUT /fines/:id rejects invalid transition PAID -> PENDING', async () => {
    prisma.fine.findFirst.mockResolvedValue({ ...FINE, status: FineStatus.PAID });

    const res = await request(app)
      .put(`/api/v1/fines/${FINE.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({ ...BASE_PAYLOAD, status: FineStatus.PENDING });

    expect(res.status).toBe(400);
  });

  it('DELETE /fines/:id performs hard delete when only creation audit exists', async () => {
    prisma.auditLog.count.mockResolvedValue(1);
    const txMock: MockTxClient = {
      fine: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({}),
      },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTxClient) => Promise<unknown>) =>
      fn(txMock),
    );

    const res = await request(app)
      .delete(`/api/v1/fines/${FINE.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ deleted: true, mode: 'hard', fineId: FINE.id });
  });

  it('DELETE /fines/:id rejects non-PENDING fine', async () => {
    prisma.fine.findFirst.mockResolvedValue({ ...FINE, status: FineStatus.PAID });

    const res = await request(app)
      .delete(`/api/v1/fines/${FINE.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(400);
  });
});
