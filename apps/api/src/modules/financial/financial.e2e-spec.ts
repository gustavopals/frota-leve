import jwt from 'jsonwebtoken';
import request from 'supertest';
import {
  FineStatus,
  PlanType,
  ServiceOrderStatus,
  TenantStatus,
  UserRole,
  VehicleStatus,
} from '@frota-leve/database';
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
  acquisitionValue: number | null;
  status: VehicleStatus;
};

type MockPrisma = {
  tenant: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock; findFirst: jest.Mock };
  vehicle: { findFirst: jest.Mock; findMany: jest.Mock; count: jest.Mock };
  fuelRecord: { findMany: jest.Mock };
  serviceOrder: { findMany: jest.Mock };
  tire: { findMany: jest.Mock };
  fine: { findMany: jest.Mock };
  document: { findMany: jest.Mock };
};

jest.mock('../../config/database', () => ({
  prisma: {
    tenant: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    vehicle: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    fuelRecord: { findMany: jest.fn() },
    serviceOrder: { findMany: jest.fn() },
    tire: { findMany: jest.fn() },
    fine: { findMany: jest.fn() },
    document: { findMany: jest.fn() },
  },
}));

const prisma = prismaClient as unknown as MockPrisma;

const TENANT: MockTenant = {
  id: 'aaaaaaaa-4444-4444-4444-444444444444',
  name: 'Tenant Financial',
  plan: PlanType.PROFESSIONAL,
  status: TenantStatus.ACTIVE,
  trialEndsAt: null,
};

const USER: MockUser = {
  id: 'bbbbbbbb-4444-4444-4444-444444444444',
  tenantId: TENANT.id,
  role: UserRole.MANAGER,
  email: 'manager@financial.com',
  isActive: true,
};

const VEHICLE_A: MockVehicle = {
  id: 'cccccccc-4444-4444-4444-444444444441',
  tenantId: TENANT.id,
  plate: 'AAA1A11',
  brand: 'Mercedes-Benz',
  model: 'Sprinter',
  year: 2024,
  currentMileage: 50000,
  acquisitionValue: 220000,
  status: VehicleStatus.ACTIVE,
};

const VEHICLE_B: MockVehicle = {
  id: 'cccccccc-4444-4444-4444-444444444442',
  tenantId: TENANT.id,
  plate: 'BBB2B22',
  brand: 'Mercedes-Benz',
  model: 'Sprinter',
  year: 2024,
  currentMileage: 45000,
  acquisitionValue: 215000,
  status: VehicleStatus.ACTIVE,
};

function makeToken(user: MockUser) {
  return jwt.sign(
    { tenantId: user.tenantId, role: user.role, email: user.email, type: 'access' },
    process.env['JWT_SECRET'] ?? 'test-secret',
    { subject: user.id, expiresIn: '1h', jwtid: 'financial-access-token' },
  );
}

function setupDefaultMocks() {
  prisma.tenant.findUnique.mockResolvedValue(TENANT);
  prisma.user.findUnique.mockResolvedValue(USER);
  prisma.user.findFirst.mockResolvedValue(USER);
  prisma.vehicle.findFirst.mockResolvedValue(VEHICLE_A);
  prisma.vehicle.findMany.mockResolvedValue([VEHICLE_A, VEHICLE_B]);
  prisma.vehicle.count.mockResolvedValue(3);

  prisma.fuelRecord.findMany.mockResolvedValue([
    { vehicleId: VEHICLE_A.id, date: new Date('2026-03-10T00:00:00.000Z'), totalCost: 1200 },
    { vehicleId: VEHICLE_A.id, date: new Date('2026-04-05T00:00:00.000Z'), totalCost: 800 },
    { vehicleId: VEHICLE_B.id, date: new Date('2026-04-07T00:00:00.000Z'), totalCost: 900 },
  ]);

  prisma.serviceOrder.findMany.mockResolvedValue([
    {
      vehicleId: VEHICLE_A.id,
      status: ServiceOrderStatus.COMPLETED,
      totalCost: 3000,
      startDate: new Date('2026-03-15T00:00:00.000Z'),
      endDate: new Date('2026-03-20T00:00:00.000Z'),
      createdAt: new Date('2026-03-10T00:00:00.000Z'),
    },
    {
      vehicleId: VEHICLE_B.id,
      status: ServiceOrderStatus.COMPLETED,
      totalCost: 1500,
      startDate: new Date('2026-04-02T00:00:00.000Z'),
      endDate: new Date('2026-04-03T00:00:00.000Z'),
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
    },
  ]);

  prisma.tire.findMany.mockResolvedValue([
    {
      currentVehicleId: VEHICLE_A.id,
      costNew: 700,
      costRetreat: 150,
      retreatCount: 2,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
    },
    {
      currentVehicleId: VEHICLE_B.id,
      costNew: 650,
      costRetreat: 120,
      retreatCount: 1,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
    },
  ]);

  prisma.fine.findMany.mockResolvedValue([
    {
      vehicleId: VEHICLE_A.id,
      status: FineStatus.PAID,
      amount: 200,
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    },
    {
      vehicleId: VEHICLE_B.id,
      status: FineStatus.PAID,
      amount: 100,
      updatedAt: new Date('2026-04-15T00:00:00.000Z'),
    },
  ]);

  prisma.document.findMany.mockResolvedValue([
    {
      vehicleId: VEHICLE_A.id,
      cost: 1000,
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
      status: 'VALID',
    },
    {
      vehicleId: VEHICLE_B.id,
      cost: 700,
      createdAt: new Date('2026-04-10T00:00:00.000Z'),
      status: 'VALID',
    },
  ]);
}

describe('Financial E2E', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it('GET /financial/tco/:vehicleId returns TCO and cost per km', async () => {
    const res = await request(app)
      .get(`/api/v1/financial/tco/${VEHICLE_A.id}?currentMarketValue=180000`)
      .set('Authorization', `Bearer ${makeToken(USER)}`);

    expect(res.status).toBe(200);
    expect(res.body.vehicle.id).toBe(VEHICLE_A.id);
    expect(res.body.components).toMatchObject({
      fuel: 2000,
      maintenance: 3000,
      tires: 1000,
      fines: 200,
      documents: 1000,
      depreciation: 40000,
    });
    expect(res.body.totals).toMatchObject({
      operational: 7200,
      tco: 47200,
      costPerKm: 0.94,
    });
  });

  it('GET /financial/overview returns consolidated monthly totals and budget comparison', async () => {
    const res = await request(app)
      .get('/api/v1/financial/overview?dateFrom=2026-03-01&dateTo=2026-04-30&monthlyBudget=5000')
      .set('Authorization', `Bearer ${makeToken(USER)}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({
      fuel: 2900,
      maintenance: 4500,
      tires: 1770,
      fines: 300,
      documents: 1700,
      total: 11170,
      vehicles: 3,
    });
    expect(res.body.monthly).toHaveLength(2);
    expect(res.body.budget).toMatchObject({
      configured: true,
      monthlyBudget: 5000,
      totalBudget: 10000,
      realized: 11170,
      variance: 1170,
      variancePercent: 11.7,
    });
  });

  it('GET /financial/comparison compares similar vehicles by operational cost and cost per km', async () => {
    const res = await request(app)
      .get(`/api/v1/financial/comparison?vehicleId=${VEHICLE_A.id}&limit=5`)
      .set('Authorization', `Bearer ${makeToken(USER)}`);

    expect(res.status).toBe(200);
    expect(res.body.referenceVehicle.vehicle.id).toBe(VEHICLE_A.id);
    expect(res.body.similarVehicles).toHaveLength(1);
    expect(res.body.similarVehicles[0].vehicle.id).toBe(VEHICLE_B.id);
    expect(res.body.benchmark).toMatchObject({
      vehicleCount: 2,
      averageOperational: 5585,
      averageCostPerKm: 0.12,
      referenceRankByCostPerKm: 1,
    });
  });

  it('GET /financial/tco/:vehicleId returns 404 when vehicle is missing', async () => {
    prisma.vehicle.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/v1/financial/tco/${VEHICLE_A.id}`)
      .set('Authorization', `Bearer ${makeToken(USER)}`);

    expect(res.status).toBe(404);
  });
});
