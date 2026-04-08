import jwt from 'jsonwebtoken';
import request from 'supertest';
import {
  DocumentStatus,
  PlanType,
  TenantStatus,
  UserRole,
  VehicleStatus,
} from '@frota-leve/database';
import { createApp } from '../../app';

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
  name: string;
};

type MockPrisma = {
  tenant: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock; findMany: jest.Mock };
  vehicle: { groupBy: jest.Mock; findMany: jest.Mock };
  driver: { count: jest.Mock; findMany: jest.Mock };
  document: { count: jest.Mock; findMany: jest.Mock };
  auditLog: { findMany: jest.Mock };
  $executeRaw: jest.Mock;
};

jest.mock('../../config/database', () => {
  const prisma: MockPrisma = {
    tenant: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    vehicle: { groupBy: jest.fn(), findMany: jest.fn() },
    driver: { count: jest.fn(), findMany: jest.fn() },
    document: { count: jest.fn(), findMany: jest.fn() },
    auditLog: { findMany: jest.fn() },
    $executeRaw: jest.fn(),
  };

  return { prisma };
});

const databaseMock = jest.requireMock('../../config/database') as {
  prisma: MockPrisma;
};
const prismaMock = databaseMock.prisma;

function createTenant(overrides: Partial<MockTenant> = {}): MockTenant {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Transportadora Alfa',
    plan: PlanType.PROFESSIONAL,
    status: TenantStatus.ACTIVE,
    trialEndsAt: null,
    ...overrides,
  };
}

function createAuthenticatedUser(tenant: MockTenant, overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    tenantId: tenant.id,
    role: UserRole.OWNER,
    email: 'owner@alfa.com',
    isActive: true,
    name: 'Owner Alfa',
    ...overrides,
  };
}

function createAccessToken(user: MockUser): string {
  return jwt.sign(
    {
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      type: 'access',
    },
    process.env['JWT_SECRET'] as string,
    {
      subject: user.id,
      expiresIn: '15m',
      jwtid: '33333333-3333-4333-8333-333333333333',
    },
  );
}

describe('Dashboard endpoints', () => {
  let app: ReturnType<typeof createApp>;
  let tenant: MockTenant;
  let authUser: MockUser;
  let accessToken: string;

  beforeEach(() => {
    app = createApp();
    tenant = createTenant();
    authUser = createAuthenticatedUser(tenant);
    accessToken = createAccessToken(authUser);

    jest.clearAllMocks();

    prismaMock.user.findUnique.mockResolvedValue(authUser);
    prismaMock.tenant.findUnique.mockResolvedValue(tenant);
  });

  it('GET /api/v1/dashboard/summary deve retornar agregados do painel', async () => {
    prismaMock.vehicle.groupBy.mockResolvedValue([
      {
        status: VehicleStatus.ACTIVE,
        _count: {
          _all: 8,
        },
      },
      {
        status: VehicleStatus.MAINTENANCE,
        _count: {
          _all: 2,
        },
      },
      {
        status: VehicleStatus.RESERVE,
        _count: {
          _all: 1,
        },
      },
    ]);
    prismaMock.vehicle.findMany.mockResolvedValue([
      {
        id: 'vehicle-1',
        plate: 'ABC1D23',
        brand: 'Volkswagen',
        model: 'Delivery',
        updatedAt: new Date('2026-04-08T10:00:00.000Z'),
      },
    ]);
    prismaMock.driver.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(3);
    prismaMock.driver.findMany.mockResolvedValue([
      {
        id: 'driver-1',
        name: 'João Lima',
        cnhCategory: 'D',
        cnhExpiration: new Date('2026-04-15T00:00:00.000Z'),
      },
    ]);
    prismaMock.document.count.mockResolvedValue(1);
    prismaMock.document.findMany.mockResolvedValue([
      {
        id: 'document-1',
        type: 'LICENSING',
        description: 'Licenciamento 2026',
        expirationDate: new Date('2026-04-10T00:00:00.000Z'),
        status: DocumentStatus.EXPIRING,
        vehicle: {
          id: 'vehicle-2',
          plate: 'XYZ9K87',
          brand: 'Mercedes',
          model: 'Sprinter',
        },
        driver: null,
      },
    ]);
    prismaMock.auditLog.findMany.mockResolvedValue([
      {
        id: 'log-1',
        action: 'VEHICLE_CREATED',
        entity: 'Vehicle',
        entityId: 'vehicle-1',
        userId: authUser.id,
        changes: {
          after: {
            plate: 'ABC1D23',
          },
        },
        createdAt: new Date('2026-04-08T09:00:00.000Z'),
      },
    ]);
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: authUser.id,
        name: authUser.name,
      },
    ]);

    const response = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      vehicles: {
        total: 11,
        active: 8,
        maintenance: 2,
        reserve: 1,
      },
      drivers: {
        total: 12,
        active: 10,
        cnhExpiring: 3,
      },
      alerts: {
        maintenanceDue: 2,
        documentsExpiring: 1,
        pendingFines: 0,
        cnhExpiring: 3,
        totalPending: 6,
      },
      costs: {
        currentMonth: 0,
        previousMonth: 0,
        variation: 0,
      },
      recentActivity: [
        {
          id: 'log-1',
          action: 'VEHICLE_CREATED',
          entity: 'Vehicle',
          entityId: 'vehicle-1',
          actorName: authUser.name,
          link: '/vehicles/vehicle-1',
        },
      ],
    });
    expect(response.body.generatedAt).toEqual(expect.any(String));
    expect(response.body.alerts.items).toHaveLength(3);
    expect(response.body.costs.monthlySeries).toHaveLength(6);
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
  });

  it('GET /api/v1/dashboard/summary deve exigir autenticação', async () => {
    const response = await request(app).get('/api/v1/dashboard/summary');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Token de autenticação não fornecido',
      },
    });
  });
});
