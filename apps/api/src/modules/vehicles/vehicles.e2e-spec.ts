import jwt from 'jsonwebtoken';
import request from 'supertest';
import {
  FuelType,
  PlanType,
  TenantStatus,
  UserRole,
  VehicleCategory,
  VehicleStatus,
} from '@frota-leve/database';
import { createApp } from '../../app';

type MockCurrentDriver = {
  id: string;
  name: string;
  email: string;
};

type MockTenant = {
  id: string;
  name: string;
  plan: PlanType;
  status: TenantStatus;
  trialEndsAt: Date | null;
};

type MockAuthenticatedUser = {
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
  renavam: string | null;
  chassis: string | null;
  brand: string;
  model: string;
  year: number;
  yearModel: number;
  color: string | null;
  fuelType: FuelType;
  category: VehicleCategory;
  status: VehicleStatus;
  currentMileage: number;
  averageConsumption: number | null;
  expectedConsumption: number | null;
  acquisitionDate: Date | null;
  acquisitionValue: number | null;
  photos: string[] | null;
  notes: string | null;
  currentDriverId: string | null;
  currentDriver: MockCurrentDriver | null;
  createdAt: Date;
  updatedAt: Date;
};

type MockAuditLog = {
  id: string;
  tenantId: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string;
  changes: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

type MockTransactionClient = {
  vehicle: {
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
  tenant: {
    findUnique: jest.Mock;
  };
  user: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
  };
  vehicle: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    count: jest.Mock;
  };
  auditLog: {
    findMany: jest.Mock;
    count: jest.Mock;
  };
  $transaction: jest.Mock;
};

jest.mock('../../config/database', () => {
  const transactionClientMock: MockTransactionClient = {
    vehicle: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const prisma: MockPrisma & {
    __transactionClientMock: MockTransactionClient;
  } = {
    tenant: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    vehicle: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
    __transactionClientMock: transactionClientMock,
  };

  return {
    prisma,
  };
});

const databaseMock = jest.requireMock('../../config/database') as {
  prisma: MockPrisma & {
    __transactionClientMock: MockTransactionClient;
  };
};

const prismaMock = databaseMock.prisma;
const transactionClientMock = databaseMock.prisma.__transactionClientMock;

function createTenant(overrides: Partial<MockTenant> = {}): MockTenant {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Transportadora Veículos',
    plan: PlanType.PROFESSIONAL,
    status: TenantStatus.ACTIVE,
    trialEndsAt: new Date('2026-12-31T00:00:00.000Z'),
    ...overrides,
  };
}

function createAuthenticatedUser(
  tenant: MockTenant,
  overrides: Partial<MockAuthenticatedUser> = {},
): MockAuthenticatedUser {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    tenantId: tenant.id,
    role: UserRole.OWNER,
    email: 'owner@vehicle.com',
    isActive: true,
    ...overrides,
  };
}

function createVehicle(overrides: Partial<MockVehicle> = {}): MockVehicle {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    tenantId: '11111111-1111-4111-8111-111111111111',
    plate: 'ABC1234',
    renavam: null,
    chassis: null,
    brand: 'Volkswagen',
    model: 'Delivery 11.180',
    year: 2022,
    yearModel: 2023,
    color: 'Branco',
    fuelType: FuelType.DIESEL,
    category: VehicleCategory.HEAVY,
    status: VehicleStatus.ACTIVE,
    currentMileage: 120000,
    averageConsumption: null,
    expectedConsumption: 8.5,
    acquisitionDate: new Date('2023-01-10T00:00:00.000Z'),
    acquisitionValue: 250000,
    photos: null,
    notes: null,
    currentDriverId: null,
    currentDriver: null,
    createdAt: new Date('2026-04-07T10:00:00.000Z'),
    updatedAt: new Date('2026-04-07T10:00:00.000Z'),
    ...overrides,
  };
}

function createAuditLog(overrides: Partial<MockAuditLog> = {}): MockAuditLog {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    tenantId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    action: 'VEHICLE_CREATED',
    entity: 'Vehicle',
    entityId: '33333333-3333-4333-8333-333333333333',
    changes: {
      after: {
        plate: 'ABC1234',
      },
    },
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    createdAt: new Date('2026-04-07T10:05:00.000Z'),
    ...overrides,
  };
}

function createAccessToken(user: MockAuthenticatedUser): string {
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
      jwtid: '55555555-5555-4555-8555-555555555555',
    },
  );
}

function createVehiclePayload(overrides: Record<string, unknown> = {}) {
  return {
    plate: 'ABC1D23',
    brand: 'Mercedes-Benz',
    model: 'Atego 1719',
    year: 2023,
    yearModel: 2024,
    fuelType: FuelType.DIESEL_S10,
    category: VehicleCategory.HEAVY,
    currentMileage: 1000,
    color: 'Azul',
    expectedConsumption: 7.2,
    notes: 'Veículo recém-adquirido',
    ...overrides,
  };
}

describe('Vehicles endpoints', () => {
  let app: ReturnType<typeof createApp>;
  let tenant: MockTenant;
  let authUser: MockAuthenticatedUser;
  let accessToken: string;

  beforeEach(() => {
    app = createApp();
    jest.resetAllMocks();

    tenant = createTenant();
    authUser = createAuthenticatedUser(tenant);
    accessToken = createAccessToken(authUser);

    prismaMock.user.findUnique.mockResolvedValue(authUser);
    prismaMock.tenant.findUnique.mockResolvedValue({
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
      status: tenant.status,
      trialEndsAt: tenant.trialEndsAt,
    });

    prismaMock.$transaction.mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) {
        return Promise.all(input);
      }

      if (typeof input === 'function') {
        return input(transactionClientMock);
      }

      return input;
    });
  });

  it('GET /api/v1/vehicles deve listar com paginação e filtros', async () => {
    const vehicle = createVehicle();

    prismaMock.vehicle.findMany.mockResolvedValue([vehicle]);
    prismaMock.vehicle.count.mockResolvedValue(1);

    const response = await request(app)
      .get('/api/v1/vehicles')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({
        page: 1,
        pageSize: 10,
        status: VehicleStatus.ACTIVE,
        search: 'abc-1234',
        sortBy: 'plate',
        sortOrder: 'asc',
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      items: [
        {
          id: vehicle.id,
          plate: vehicle.plate,
        },
      ],
      meta: {
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
      },
    });
    expect(prismaMock.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: tenant.id,
          status: VehicleStatus.ACTIVE,
          OR: expect.arrayContaining([
            expect.objectContaining({
              plate: expect.objectContaining({
                contains: 'ABC1234',
              }),
            }),
          ]),
        }),
      }),
    );
  });

  it('GET /api/v1/vehicles/:id deve retornar detalhes com timeline', async () => {
    const vehicle = createVehicle();
    const timeline = [createAuditLog()];

    prismaMock.vehicle.findFirst.mockResolvedValue(vehicle);
    prismaMock.auditLog.findMany.mockResolvedValue(timeline);

    const response = await request(app)
      .get(`/api/v1/vehicles/${vehicle.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: vehicle.id,
      plate: vehicle.plate,
      timeline: [
        {
          id: timeline[0].id,
          action: timeline[0].action,
        },
      ],
    });
  });

  it('POST /api/v1/vehicles deve criar veículo e registrar audit log', async () => {
    const createdVehicle = createVehicle({
      id: '66666666-6666-4666-8666-666666666666',
      plate: 'ABC1D23',
      brand: 'Mercedes-Benz',
      model: 'Atego 1719',
      currentMileage: 1000,
      fuelType: FuelType.DIESEL_S10,
    });

    prismaMock.vehicle.count.mockResolvedValue(0);
    prismaMock.vehicle.findFirst.mockResolvedValue(null);
    transactionClientMock.vehicle.create.mockResolvedValue(createdVehicle);
    transactionClientMock.auditLog.create.mockResolvedValue(createAuditLog());

    const response = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(createVehiclePayload());

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: createdVehicle.id,
      plate: createdVehicle.plate,
      brand: createdVehicle.brand,
      status: VehicleStatus.ACTIVE,
    });
    expect(transactionClientMock.vehicle.create).toHaveBeenCalled();
    expect(transactionClientMock.auditLog.create).toHaveBeenCalled();
  });

  it('POST /api/v1/vehicles deve falhar ao exceder limite do plano', async () => {
    tenant = createTenant({
      plan: PlanType.ESSENTIAL,
    });
    authUser = createAuthenticatedUser(tenant);
    accessToken = createAccessToken(authUser);

    prismaMock.user.findUnique.mockResolvedValue(authUser);
    prismaMock.tenant.findUnique.mockResolvedValue({
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
      status: tenant.status,
      trialEndsAt: tenant.trialEndsAt,
    });
    prismaMock.vehicle.count.mockResolvedValue(10);

    const response = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(createVehiclePayload());

    expect(response.status).toBe(402);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'PLAN_LIMIT_EXCEEDED',
      },
    });
  });

  it('POST /api/v1/vehicles deve falhar com placa inválida', async () => {
    const response = await request(app)
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(
        createVehiclePayload({
          plate: 'PLACA-ERRADA',
        }),
      );

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
      },
    });
  });

  it('PUT /api/v1/vehicles/:id deve atualizar veículo', async () => {
    const currentVehicle = createVehicle();
    const updatedVehicle = createVehicle({
      model: 'Delivery 13.180',
      color: 'Prata',
      currentMileage: 125000,
    });

    prismaMock.vehicle.findFirst.mockResolvedValueOnce(currentVehicle).mockResolvedValueOnce(null);
    transactionClientMock.vehicle.update.mockResolvedValue(updatedVehicle);
    transactionClientMock.auditLog.create.mockResolvedValue(createAuditLog());

    const response = await request(app)
      .put(`/api/v1/vehicles/${currentVehicle.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(
        createVehiclePayload({
          plate: currentVehicle.plate,
          brand: currentVehicle.brand,
          model: updatedVehicle.model,
          year: currentVehicle.year,
          yearModel: currentVehicle.yearModel,
          fuelType: currentVehicle.fuelType,
          category: currentVehicle.category,
          currentMileage: updatedVehicle.currentMileage,
          color: updatedVehicle.color,
        }),
      );

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: currentVehicle.id,
      model: updatedVehicle.model,
      currentMileage: updatedVehicle.currentMileage,
    });
  });

  it('PATCH /api/v1/vehicles/:id/status deve bloquear retorno de baixado para ativo', async () => {
    const vehicle = createVehicle({
      status: VehicleStatus.DECOMMISSIONED,
    });

    prismaMock.vehicle.findFirst.mockResolvedValue(vehicle);

    const response = await request(app)
      .patch(`/api/v1/vehicles/${vehicle.id}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        status: VehicleStatus.ACTIVE,
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Veículo baixado não pode mudar para outro status',
      },
    });
  });

  it('PATCH /api/v1/vehicles/:id/mileage deve bloquear quilometragem regressiva', async () => {
    const vehicle = createVehicle({
      currentMileage: 50000,
    });

    prismaMock.vehicle.findFirst.mockResolvedValue(vehicle);

    const response = await request(app)
      .patch(`/api/v1/vehicles/${vehicle.id}/mileage`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        mileage: 49999,
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Nova quilometragem não pode ser menor que a atual',
      },
    });
  });

  it('DELETE /api/v1/vehicles/:id deve fazer hard delete quando não houve movimentação', async () => {
    const vehicle = createVehicle({
      currentMileage: 0,
    });

    prismaMock.vehicle.findFirst.mockResolvedValue(vehicle);
    prismaMock.auditLog.count.mockResolvedValue(1);
    transactionClientMock.auditLog.deleteMany.mockResolvedValue({ count: 1 });
    transactionClientMock.vehicle.delete.mockResolvedValue(vehicle);

    const response = await request(app)
      .delete(`/api/v1/vehicles/${vehicle.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      deleted: true,
      mode: 'hard',
      vehicleId: vehicle.id,
    });
  });

  it('DELETE /api/v1/vehicles/:id deve fazer soft delete quando já existe histórico', async () => {
    const vehicle = createVehicle({
      status: VehicleStatus.ACTIVE,
    });

    prismaMock.vehicle.findFirst.mockResolvedValue(vehicle);
    prismaMock.auditLog.count.mockResolvedValue(3);
    transactionClientMock.vehicle.update.mockResolvedValue(
      createVehicle({
        ...vehicle,
        status: VehicleStatus.DECOMMISSIONED,
      }),
    );
    transactionClientMock.auditLog.create.mockResolvedValue(createAuditLog());

    const response = await request(app)
      .delete(`/api/v1/vehicles/${vehicle.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      deleted: true,
      mode: 'soft',
      vehicleId: vehicle.id,
    });
  });

  it('POST /api/v1/vehicles/import deve importar CSV e retornar erros por linha', async () => {
    const importedVehicle = createVehicle({
      id: '77777777-7777-4777-8777-777777777777',
      plate: 'ABC1D23',
      brand: 'Volvo',
      model: 'VM 270',
    });

    prismaMock.vehicle.findMany.mockResolvedValue([]);
    prismaMock.vehicle.count.mockResolvedValue(0);
    transactionClientMock.vehicle.create.mockResolvedValue(importedVehicle);
    transactionClientMock.auditLog.create.mockResolvedValue(createAuditLog());

    const csv = [
      'plate,brand,model,year,yearModel,fuelType,category,currentMileage',
      'ABC1D23,Volvo,VM 270,2023,2024,DIESEL,HEAVY,1000',
      'PLACAINVALIDA,Ford,Cargo,2020,2021,DIESEL,HEAVY,500',
    ].join('\n');

    const response = await request(app)
      .post('/api/v1/vehicles/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from(csv, 'utf-8'), 'vehicles.csv');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      importedCount: 1,
      errorCount: 1,
      items: [
        {
          id: importedVehicle.id,
          plate: importedVehicle.plate,
        },
      ],
      errors: [
        {
          row: 3,
        },
      ],
    });
  });

  it('GET /api/v1/vehicles/export deve retornar CSV', async () => {
    const vehicle = createVehicle();

    prismaMock.vehicle.findMany.mockResolvedValue([vehicle]);

    const response = await request(app)
      .get('/api/v1/vehicles/export')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('plate,brand,model');
    expect(response.text).toContain('ABC-1234');
  });

  it('GET /api/v1/vehicles/stats deve retornar resumo da frota', async () => {
    prismaMock.vehicle.findMany.mockResolvedValue([
      {
        status: VehicleStatus.ACTIVE,
        category: VehicleCategory.HEAVY,
        fuelType: FuelType.DIESEL,
        currentMileage: 1000,
        yearModel: 2023,
      },
      {
        status: VehicleStatus.MAINTENANCE,
        category: VehicleCategory.LIGHT,
        fuelType: FuelType.GASOLINE,
        currentMileage: 3000,
        yearModel: 2022,
      },
    ]);

    const response = await request(app)
      .get('/api/v1/vehicles/stats')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      total: 2,
      byStatus: {
        ACTIVE: 1,
        MAINTENANCE: 1,
      },
      byCategory: {
        HEAVY: 1,
        LIGHT: 1,
      },
      byFuelType: {
        DIESEL: 1,
        GASOLINE: 1,
      },
      averageMileage: 2000,
    });
  });
});
