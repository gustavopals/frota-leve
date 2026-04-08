import jwt from 'jsonwebtoken';
import request from 'supertest';
import { PlanType, TenantStatus, UserRole, VehicleStatus } from '@frota-leve/database';
import { createApp } from '../../app';

// ─── Mock types ───────────────────────────────────────────────────────────────

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

type MockDriver = {
  id: string;
  tenantId: string;
  name: string;
  cpf: string;
  phone: string | null;
  email: string | null;
  birthDate: Date | null;
  cnhNumber: string | null;
  cnhCategory: string | null;
  cnhExpiration: Date | null;
  cnhPoints: number;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  department: string | null;
  isActive: boolean;
  photoUrl: string | null;
  hireDate: Date | null;
  score: number;
  notes: string | null;
  userId: string | null;
  user: null;
  createdAt: Date;
  updatedAt: Date;
};

type MockVehicle = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  status: VehicleStatus;
  currentDriverId: string | null;
};

type MockTransactionClient = {
  driver: {
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    findFirst: jest.Mock;
  };
  vehicle: {
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
  driver: { findMany: jest.Mock; findFirst: jest.Mock; count: jest.Mock };
  vehicle: { findMany: jest.Mock; findFirst: jest.Mock };
  auditLog: { findMany: jest.Mock; count: jest.Mock };
  $transaction: jest.Mock;
};

// ─── Mock de database ────────────────────────────────────────────────────────

jest.mock('../../config/database', () => {
  const transactionClientMock: MockTransactionClient = {
    driver: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
    },
    vehicle: {
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const prisma: MockPrisma & { __transactionClientMock: MockTransactionClient } = {
    tenant: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    driver: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
    vehicle: { findMany: jest.fn(), findFirst: jest.fn() },
    auditLog: { findMany: jest.fn(), count: jest.fn() },
    $transaction: jest.fn(),
    __transactionClientMock: transactionClientMock,
  };

  return { prisma };
});

const databaseMock = jest.requireMock('../../config/database') as {
  prisma: MockPrisma & { __transactionClientMock: MockTransactionClient };
};
const prismaMock = databaseMock.prisma;
const txMock = databaseMock.prisma.__transactionClientMock;

// ─── Factories ────────────────────────────────────────────────────────────────

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
    ...overrides,
  };
}

function createDriver(overrides: Partial<MockDriver> = {}): MockDriver {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    tenantId: '11111111-1111-4111-8111-111111111111',
    name: 'João Silva',
    cpf: '52998224725',
    phone: '11987654321',
    email: 'joao@alfa.com',
    birthDate: new Date('1985-06-15T00:00:00.000Z'),
    cnhNumber: '12345678901',
    cnhCategory: 'D',
    cnhExpiration: new Date('2027-01-01T00:00:00.000Z'),
    cnhPoints: 0,
    emergencyContact: 'Maria Silva',
    emergencyPhone: '11912345678',
    department: 'Logística',
    isActive: true,
    photoUrl: null,
    hireDate: new Date('2020-03-01T00:00:00.000Z'),
    score: 95,
    notes: null,
    userId: null,
    user: null,
    createdAt: new Date('2026-04-07T10:00:00.000Z'),
    updatedAt: new Date('2026-04-07T10:00:00.000Z'),
    ...overrides,
  };
}

function createVehicle(overrides: Partial<MockVehicle> = {}): MockVehicle {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    plate: 'ABC1D23',
    brand: 'Volkswagen',
    model: 'Delivery 11.180',
    year: 2022,
    status: VehicleStatus.ACTIVE,
    currentDriverId: null,
    ...overrides,
  };
}

function createAccessToken(user: MockUser): string {
  return jwt.sign(
    { tenantId: user.tenantId, role: user.role, email: user.email, type: 'access' },
    process.env['JWT_SECRET'] as string,
    { subject: user.id, expiresIn: '15m', jwtid: '55555555-5555-4555-8555-555555555555' },
  );
}

function createDriverPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Carlos Pereira',
    cpf: '529.982.247-25',
    phone: '11987654321',
    email: 'carlos@alfa.com',
    cnhNumber: '98765432100',
    cnhCategory: 'D',
    cnhExpiration: '2028-06-01',
    department: 'Logística',
    hireDate: '2022-01-10',
    ...overrides,
  };
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe('Drivers endpoints', () => {
  let app: ReturnType<typeof createApp>;
  let tenant: MockTenant;
  let authUser: MockUser;
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
      if (Array.isArray(input)) return Promise.all(input);
      if (typeof input === 'function') return input(txMock);
      return input;
    });
  });

  // ── GET /drivers ────────────────────────────────────────────────────────────

  it('GET /api/v1/drivers deve listar com paginação e filtros', async () => {
    const driver = createDriver();

    prismaMock.driver.findMany.mockResolvedValue([driver]);
    prismaMock.driver.count.mockResolvedValue(1);

    const response = await request(app)
      .get('/api/v1/drivers')
      .set('Authorization', `Bearer ${accessToken}`)
      .query({ page: 1, pageSize: 10, isActive: true, search: 'João' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      items: [{ id: driver.id, name: driver.name, cpf: driver.cpf }],
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
    expect(prismaMock.driver.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: tenant.id, isActive: true }),
      }),
    );
  });

  it('GET /api/v1/drivers deve incluir flag cnhExpiring', async () => {
    const expiringDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // daqui 10 dias
    const driver = createDriver({ cnhExpiration: expiringDate });

    prismaMock.driver.findMany.mockResolvedValue([driver]);
    prismaMock.driver.count.mockResolvedValue(1);

    const response = await request(app)
      .get('/api/v1/drivers')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.items[0].cnhExpiring).toBe(true);
  });

  // ── GET /drivers/:id ────────────────────────────────────────────────────────

  it('GET /api/v1/drivers/:id deve retornar detalhes com histórico', async () => {
    const driver = createDriver();

    prismaMock.driver.findFirst.mockResolvedValue(driver);
    prismaMock.auditLog.findMany.mockResolvedValue([]);
    prismaMock.vehicle.findMany.mockResolvedValue([]);

    const response = await request(app)
      .get(`/api/v1/drivers/${driver.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: driver.id,
      name: driver.name,
      history: { driverId: driver.id, assignedVehicles: [], auditLog: [] },
    });
  });

  it('GET /api/v1/drivers/:id deve retornar 404 para motorista inexistente', async () => {
    prismaMock.driver.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/v1/drivers/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  // ── POST /drivers ───────────────────────────────────────────────────────────

  it('POST /api/v1/drivers deve criar motorista e registrar audit log', async () => {
    const created = createDriver({ id: '66666666-6666-4666-8666-666666666666' });

    prismaMock.driver.findFirst.mockResolvedValue(null); // CPF único
    txMock.driver.create.mockResolvedValue(created);
    txMock.auditLog.create.mockResolvedValue({});

    const response = await request(app)
      .post('/api/v1/drivers')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(createDriverPayload());

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ id: created.id, name: created.name });
    expect(txMock.driver.create).toHaveBeenCalled();
    expect(txMock.auditLog.create).toHaveBeenCalled();
  });

  it('POST /api/v1/drivers deve falhar com CPF inválido', async () => {
    const response = await request(app)
      .post('/api/v1/drivers')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(createDriverPayload({ cpf: '111.111.111-11' }));

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
  });

  it('POST /api/v1/drivers deve falhar com CPF duplicado', async () => {
    prismaMock.driver.findFirst.mockResolvedValue(createDriver()); // já existe

    const response = await request(app)
      .post('/api/v1/drivers')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(createDriverPayload());

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ success: false, error: { code: 'CONFLICT' } });
  });

  it('POST /api/v1/drivers deve ser bloqueado para VIEWER', async () => {
    authUser = createAuthenticatedUser(tenant, { role: UserRole.VIEWER });
    accessToken = createAccessToken(authUser);
    prismaMock.user.findUnique.mockResolvedValue(authUser);

    const response = await request(app)
      .post('/api/v1/drivers')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(createDriverPayload());

    expect(response.status).toBe(403);
  });

  // ── PUT /drivers/:id ────────────────────────────────────────────────────────

  it('PUT /api/v1/drivers/:id deve atualizar motorista', async () => {
    const current = createDriver();
    const updated = createDriver({ name: 'Carlos Atualizado', cnhPoints: 5 });

    prismaMock.driver.findFirst
      .mockResolvedValueOnce(current) // findDriverOrThrow
      .mockResolvedValueOnce(null); // ensureUniqueCpf
    txMock.driver.update.mockResolvedValue(updated);
    txMock.auditLog.create.mockResolvedValue({});

    const response = await request(app)
      .put(`/api/v1/drivers/${current.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send(createDriverPayload({ name: 'Carlos Atualizado' }));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: current.id, name: updated.name });
  });

  // ── DELETE /drivers/:id ─────────────────────────────────────────────────────

  it('DELETE /api/v1/drivers/:id deve fazer hard delete quando não há histórico', async () => {
    const driver = createDriver();

    prismaMock.driver.findFirst.mockResolvedValue(driver);
    prismaMock.auditLog.count.mockResolvedValue(1);
    txMock.auditLog.deleteMany.mockResolvedValue({ count: 1 });
    txMock.driver.delete.mockResolvedValue(driver);

    const response = await request(app)
      .delete(`/api/v1/drivers/${driver.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deleted: true, mode: 'hard', driverId: driver.id });
    expect(txMock.driver.delete).toHaveBeenCalled();
  });

  it('DELETE /api/v1/drivers/:id deve fazer soft delete quando há histórico', async () => {
    const driver = createDriver();

    prismaMock.driver.findFirst.mockResolvedValue(driver);
    prismaMock.auditLog.count.mockResolvedValue(5);
    txMock.driver.update.mockResolvedValue({ ...driver, isActive: false });
    txMock.auditLog.create.mockResolvedValue({});

    const response = await request(app)
      .delete(`/api/v1/drivers/${driver.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deleted: true, mode: 'soft', driverId: driver.id });
    expect(txMock.driver.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });

  // ── GET /drivers/:id/history ────────────────────────────────────────────────

  it('GET /api/v1/drivers/:id/history deve retornar histórico do motorista', async () => {
    const userId = '77777777-7777-4777-8777-777777777777';
    const driver = createDriver({ userId });
    const vehicle = createVehicle({ currentDriverId: userId });

    prismaMock.driver.findFirst.mockResolvedValue(driver);
    prismaMock.auditLog.findMany.mockResolvedValue([]);
    prismaMock.vehicle.findMany.mockResolvedValue([vehicle]);

    const response = await request(app)
      .get(`/api/v1/drivers/${driver.id}/history`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      driverId: driver.id,
      assignedVehicles: [{ id: vehicle.id, plate: vehicle.plate }],
      auditLog: [],
    });
  });

  // ── PATCH /drivers/:id/link-vehicle/:vehicleId ──────────────────────────────

  it('PATCH /drivers/:id/link-vehicle/:vehicleId deve vincular motorista ao veículo', async () => {
    const userId = '88888888-8888-4888-8888-888888888888';
    const driver = createDriver({ userId });
    const vehicle = createVehicle();
    const updatedDriver = createDriver({ userId });

    prismaMock.driver.findFirst.mockResolvedValue(driver);
    prismaMock.vehicle.findFirst.mockResolvedValue(vehicle);
    txMock.vehicle.update.mockResolvedValue({ ...vehicle, currentDriverId: userId });
    txMock.auditLog.create.mockResolvedValue({});
    txMock.driver.findFirst.mockResolvedValue(updatedDriver);

    const response = await request(app)
      .patch(`/api/v1/drivers/${driver.id}/link-vehicle/${vehicle.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(200);
    expect(txMock.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentDriverId: userId } }),
    );
  });

  it('PATCH /drivers/:id/link-vehicle deve falhar para motorista sem conta de usuário', async () => {
    const driver = createDriver({ userId: null });
    const vehicle = createVehicle();

    prismaMock.driver.findFirst.mockResolvedValue(driver);
    prismaMock.vehicle.findFirst.mockResolvedValue(vehicle);

    const response = await request(app)
      .patch(`/api/v1/drivers/${driver.id}/link-vehicle/${vehicle.id}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(403);
  });

  // ── POST /drivers/import ────────────────────────────────────────────────────

  it('POST /api/v1/drivers/import deve importar CSV e retornar erros por linha', async () => {
    const imported = createDriver({
      id: '99999999-9999-4999-8999-999999999999',
      name: 'Ana Souza',
    });

    prismaMock.driver.findMany.mockResolvedValue([]);
    txMock.driver.create.mockResolvedValue(imported);
    txMock.auditLog.create.mockResolvedValue({});

    const csv = [
      'nome,cpf,telefone,departamento',
      'Ana Souza,529.982.247-25,11987654321,Logística',
      'Carlos,111.111.111-11,11900000000,TI', // CPF inválido
    ].join('\n');

    const response = await request(app)
      .post('/api/v1/drivers/import')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from(csv, 'utf-8'), 'drivers.csv');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      importedCount: 1,
      errorCount: 1,
      errors: [{ row: 3 }],
    });
  });
});
