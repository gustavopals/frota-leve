import jwt from 'jsonwebtoken';
import request from 'supertest';
import { FuelType, PlanType, TenantStatus, UserRole, VehicleStatus } from '@frota-leve/database';
import { createApp } from '../../app';
import { prisma as prismaClient } from '../../config/database';

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

type MockVehicle = {
  id: string;
  tenantId: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  yearModel: number;
  status: VehicleStatus;
  currentMileage: number;
  averageConsumption: number | null;
  currentDriverId: string | null;
};

type MockDriver = {
  id: string;
  tenantId: string;
  name: string;
  cpf: string;
};

type MockFuelRecord = {
  id: string;
  tenantId: string;
  vehicleId: string;
  driverId: string | null;
  date: Date;
  mileage: number;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  fuelType: FuelType;
  fullTank: boolean;
  gasStation: string | null;
  notes: string | null;
  receiptUrl: string | null;
  kmPerLiter: number | null;
  anomaly: boolean;
  anomalyReason: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type MockTransactionClient = {
  fuelRecord: {
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  vehicle: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  auditLog: {
    create: jest.Mock;
  };
};

type MockPrisma = {
  tenant: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock; findFirst: jest.Mock };
  vehicle: { findFirst: jest.Mock; findMany: jest.Mock };
  driver: { findFirst: jest.Mock };
  fuelRecord: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    count: jest.Mock;
    aggregate: jest.Mock;
    groupBy: jest.Mock;
  };
  $transaction: jest.Mock;
};

// ─── Mock setup ───────────────────────────────────────────────────────────────

jest.mock('../../config/database', () => ({
  prisma: {
    tenant: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    vehicle: { findFirst: jest.fn(), findMany: jest.fn() },
    driver: { findFirst: jest.fn() },
    fuelRecord: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const prisma = prismaClient as unknown as MockPrisma;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

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
  model: 'Corolla',
  year: 2022,
  yearModel: 2022,
  status: VehicleStatus.ACTIVE,
  currentMileage: 50000,
  averageConsumption: 12.5,
  currentDriverId: null,
};

const SECOND_VEHICLE: MockVehicle = {
  id: 'cccccccc-0000-0000-0000-000000000002',
  tenantId: TENANT.id,
  plate: 'XYZ9K87',
  brand: 'Volkswagen',
  model: 'Saveiro',
  year: 2023,
  yearModel: 2023,
  status: VehicleStatus.ACTIVE,
  currentMileage: 42000,
  averageConsumption: 11.2,
  currentDriverId: null,
};

const DRIVER: MockDriver = {
  id: 'dddddddd-0000-0000-0000-000000000001',
  tenantId: TENANT.id,
  name: 'João Silva',
  cpf: '12345678901',
};

const FUEL_RECORD: MockFuelRecord = {
  id: 'eeeeeeee-0000-0000-0000-000000000001',
  tenantId: TENANT.id,
  vehicleId: VEHICLE.id,
  driverId: DRIVER.id,
  date: new Date('2026-04-01T10:00:00Z'),
  mileage: 51000,
  liters: 45.5,
  pricePerLiter: 5.89,
  totalCost: 268.0,
  fuelType: FuelType.GASOLINE,
  fullTank: true,
  gasStation: 'Posto Shell Centro',
  notes: null,
  receiptUrl: null,
  kmPerLiter: 10.5,
  anomaly: false,
  anomalyReason: null,
  createdByUserId: OWNER.id,
  createdAt: new Date('2026-04-01T10:05:00Z'),
  updatedAt: new Date('2026-04-01T10:05:00Z'),
};

const FUEL_RECORD_WITH_RELATIONS = {
  ...FUEL_RECORD,
  vehicle: {
    id: VEHICLE.id,
    plate: VEHICLE.plate,
    brand: VEHICLE.brand,
    model: VEHICLE.model,
    year: VEHICLE.year,
  },
  driver: { id: DRIVER.id, name: DRIVER.name, cpf: DRIVER.cpf },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeToken(user: MockUser) {
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
      jwtid: 'ffffeeee-0000-4000-8000-000000000001',
    },
  );
}

function setupDefaultMocks() {
  prisma.tenant.findUnique.mockResolvedValue(TENANT);
  prisma.user.findUnique.mockResolvedValue(OWNER);
  prisma.user.findFirst.mockResolvedValue(OWNER);
  prisma.vehicle.findFirst.mockResolvedValue(VEHICLE);
  prisma.vehicle.findMany.mockResolvedValue([VEHICLE]);
  prisma.driver.findFirst.mockResolvedValue(DRIVER);
  prisma.fuelRecord.findMany.mockResolvedValue([FUEL_RECORD_WITH_RELATIONS]);
  prisma.fuelRecord.findFirst.mockResolvedValue(FUEL_RECORD_WITH_RELATIONS);
  prisma.fuelRecord.count.mockResolvedValue(1);
  prisma.fuelRecord.aggregate.mockResolvedValue({
    _count: { id: 1 },
    _sum: { totalCost: 268.0, liters: 45.5 },
    _avg: { kmPerLiter: 10.5, pricePerLiter: 5.89 },
  });
  prisma.fuelRecord.groupBy.mockResolvedValue([]);
}

const BASE_PAYLOAD = {
  vehicleId: VEHICLE.id,
  driverId: DRIVER.id,
  date: '2026-04-01T10:00:00Z',
  mileage: 51000,
  liters: 45.5,
  pricePerLiter: 5.89,
  totalCost: 268.0,
  fuelType: FuelType.GASOLINE,
  fullTank: true,
  gasStation: 'Posto Shell Centro',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FuelRecords E2E', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  // ── GET /fuel-records ────────────────────────────────────────────────────

  it('GET /fuel-records returns paginated list', async () => {
    const res = await request(app)
      .get('/api/v1/fuel-records')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ vehicleId: VEHICLE.id });
    expect(res.body.meta).toMatchObject({ page: 1, total: 1 });
  });

  it('GET /fuel-records filters by vehicleId', async () => {
    prisma.fuelRecord.findMany.mockResolvedValue([]);
    prisma.fuelRecord.count.mockResolvedValue(0);

    const res = await request(app)
      .get(`/api/v1/fuel-records?vehicleId=${VEHICLE.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(0);
  });

  it('GET /fuel-records filters anomaly=true', async () => {
    const anomalousRecord = {
      ...FUEL_RECORD_WITH_RELATIONS,
      anomaly: true,
      anomalyReason: 'km/l abaixo da média',
    };
    prisma.fuelRecord.findMany.mockResolvedValue([anomalousRecord]);
    prisma.fuelRecord.count.mockResolvedValue(1);

    const res = await request(app)
      .get('/api/v1/fuel-records?anomaly=true')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.items[0].anomaly).toBe(true);
  });

  // ── GET /vehicles/:vehicleId/fuel-records ────────────────────────────────

  it('GET /vehicles/:vehicleId/fuel-records returns records for vehicle', async () => {
    const res = await request(app)
      .get(`/api/v1/vehicles/${VEHICLE.id}/fuel-records`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  // ── GET /fuel-records/:id ────────────────────────────────────────────────

  it('GET /fuel-records/:id returns single record', async () => {
    const res = await request(app)
      .get(`/api/v1/fuel-records/${FUEL_RECORD.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(FUEL_RECORD.id);
    expect(res.body.vehicle.plate).toBe(VEHICLE.plate);
  });

  it('GET /fuel-records/:id returns 404 for unknown id', async () => {
    prisma.fuelRecord.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/v1/fuel-records/ffffffff-0000-0000-0000-000000000099')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(404);
  });

  // ── POST /fuel-records ───────────────────────────────────────────────────

  it('POST /fuel-records creates a record and returns 201', async () => {
    const txMock: MockTransactionClient = {
      fuelRecord: {
        create: jest.fn().mockResolvedValue(FUEL_RECORD_WITH_RELATIONS),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null), // no previous full-tank
        findMany: jest.fn().mockResolvedValue([]),
      },
      vehicle: {
        findUnique: jest.fn().mockResolvedValue(VEHICLE),
        update: jest.fn().mockResolvedValue(VEHICLE),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTransactionClient) => Promise<unknown>) =>
      fn(txMock),
    );

    const res = await request(app)
      .post('/api/v1/fuel-records')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.vehicleId).toBe(VEHICLE.id);
    expect(txMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'FUEL_RECORD_CREATED' }) }),
    );
  });

  it('POST /fuel-records allows historical mileage below the vehicle current mileage', async () => {
    const txMock: MockTransactionClient = {
      fuelRecord: {
        create: jest.fn().mockResolvedValue({
          ...FUEL_RECORD_WITH_RELATIONS,
          mileage: 49000,
          kmPerLiter: null,
        }),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      vehicle: {
        findUnique: jest.fn().mockResolvedValue(VEHICLE),
        update: jest.fn().mockResolvedValue(VEHICLE),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTransactionClient) => Promise<unknown>) =>
      fn(txMock),
    );

    const res = await request(app)
      .post('/api/v1/fuel-records')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({ ...BASE_PAYLOAD, mileage: 49000 });

    expect(res.status).toBe(201);
    expect(res.body.mileage).toBe(49000);
  });

  it('POST /fuel-records detects anomaly when km/l < 60% of average', async () => {
    // averageConsumption = 12.5, threshold = 7.5, we'll have km/l = 4.4
    const prevRecord = { ...FUEL_RECORD, mileage: 50800, fullTank: true };
    prisma.fuelRecord.findFirst.mockResolvedValue(prevRecord);

    const txMock: MockTransactionClient = {
      fuelRecord: {
        create: jest
          .fn()
          .mockImplementation((args: { data: { anomaly: boolean } }) =>
            Promise.resolve({ ...FUEL_RECORD_WITH_RELATIONS, anomaly: args.data.anomaly }),
          ),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(prevRecord),
        findMany: jest.fn().mockResolvedValue([]),
      },
      vehicle: {
        findUnique: jest.fn().mockResolvedValue(VEHICLE),
        update: jest.fn().mockResolvedValue(VEHICLE),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTransactionClient) => Promise<unknown>) =>
      fn(txMock),
    );

    // mileage=51000, prev=50800, distance=200km, liters=45.5 → km/l≈4.4 (< 60% of 12.5=7.5)
    const res = await request(app)
      .post('/api/v1/fuel-records')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({ ...BASE_PAYLOAD, mileage: 51000 });

    expect(res.status).toBe(201);
    expect(res.body.anomaly).toBe(true);
    expect(prisma.fuelRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT.id,
          vehicleId: VEHICLE.id,
          fullTank: true,
          date: { lte: new Date(BASE_PAYLOAD.date) },
          mileage: { lt: 51000 },
        }),
        orderBy: [{ date: 'desc' }, { mileage: 'desc' }],
      }),
    );
  });

  it('POST /fuel-records returns 400 for missing vehicleId', async () => {
    const { vehicleId: _v, ...withoutVehicle } = BASE_PAYLOAD;

    const res = await request(app)
      .post('/api/v1/fuel-records')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send(withoutVehicle);

    expect(res.status).toBe(400);
  });

  it('POST /fuel-records returns 403 for VIEWER role', async () => {
    prisma.user.findUnique.mockResolvedValue(VIEWER);
    prisma.user.findFirst.mockResolvedValue(VIEWER);

    const res = await request(app)
      .post('/api/v1/fuel-records')
      .set('Authorization', `Bearer ${makeToken(VIEWER)}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(403);
  });

  it('POST /fuel-records returns 404 when vehicle not found', async () => {
    prisma.vehicle.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/fuel-records')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(404);
  });

  // ── PUT /fuel-records/:id ────────────────────────────────────────────────

  it('PUT /fuel-records/:id updates record', async () => {
    const txMock: MockTransactionClient = {
      fuelRecord: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ ...FUEL_RECORD_WITH_RELATIONS, liters: 50 }),
        delete: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      vehicle: {
        findUnique: jest.fn().mockResolvedValue(VEHICLE),
        update: jest.fn().mockResolvedValue(VEHICLE),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTransactionClient) => Promise<unknown>) =>
      fn(txMock),
    );
    prisma.fuelRecord.findFirst.mockResolvedValue(FUEL_RECORD);

    const res = await request(app)
      .put(`/api/v1/fuel-records/${FUEL_RECORD.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({ ...BASE_PAYLOAD, liters: 50 });

    expect(res.status).toBe(200);
    expect(txMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'FUEL_RECORD_UPDATED' }) }),
    );
  });

  it('PUT /fuel-records/:id recalculates averages for original and target vehicles', async () => {
    const txMock: MockTransactionClient = {
      fuelRecord: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          ...FUEL_RECORD_WITH_RELATIONS,
          vehicleId: SECOND_VEHICLE.id,
          vehicle: {
            id: SECOND_VEHICLE.id,
            plate: SECOND_VEHICLE.plate,
            brand: SECOND_VEHICLE.brand,
            model: SECOND_VEHICLE.model,
            year: SECOND_VEHICLE.year,
          },
        }),
        delete: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      vehicle: {
        findUnique: jest
          .fn()
          .mockImplementation(({ where: { id } }: { where: { id: string } }) =>
            Promise.resolve(id === SECOND_VEHICLE.id ? SECOND_VEHICLE : VEHICLE),
          ),
        update: jest.fn().mockResolvedValue(SECOND_VEHICLE),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTransactionClient) => Promise<unknown>) =>
      fn(txMock),
    );
    prisma.fuelRecord.findFirst.mockResolvedValue(FUEL_RECORD);
    prisma.vehicle.findFirst.mockResolvedValue(SECOND_VEHICLE);

    const res = await request(app)
      .put(`/api/v1/fuel-records/${FUEL_RECORD.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({ ...BASE_PAYLOAD, vehicleId: SECOND_VEHICLE.id });

    expect(res.status).toBe(200);
    expect(txMock.fuelRecord.findMany).toHaveBeenCalledTimes(2);
    expect(txMock.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VEHICLE.id },
        data: { averageConsumption: null },
      }),
    );
    expect(txMock.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SECOND_VEHICLE.id },
        data: { averageConsumption: null },
      }),
    );
  });

  // ── DELETE /fuel-records/:id ─────────────────────────────────────────────

  it('DELETE /fuel-records/:id deletes record', async () => {
    const txMock: MockTransactionClient = {
      fuelRecord: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue(FUEL_RECORD),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      vehicle: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue(VEHICLE) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTransactionClient) => Promise<unknown>) =>
      fn(txMock),
    );
    prisma.fuelRecord.findFirst.mockResolvedValue(FUEL_RECORD);

    const res = await request(app)
      .delete(`/api/v1/fuel-records/${FUEL_RECORD.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ deleted: true, fuelRecordId: FUEL_RECORD.id });
    expect(txMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'FUEL_RECORD_DELETED' }) }),
    );
    expect(txMock.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VEHICLE.id },
        data: { averageConsumption: null },
      }),
    );
  });

  it('DELETE /fuel-records/:id returns 404 for unknown id', async () => {
    prisma.fuelRecord.findFirst.mockResolvedValue(null);

    const res = await request(app)
      .delete('/api/v1/fuel-records/ffffffff-0000-0000-0000-000000000099')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(404);
  });

  // ── GET /fuel-records/stats ──────────────────────────────────────────────

  it('GET /fuel-records/stats returns aggregated stats', async () => {
    prisma.fuelRecord.count.mockResolvedValue(5);
    // findFirst for costPerKm calculation
    prisma.fuelRecord.findFirst
      .mockResolvedValueOnce({ mileage: 50000 })
      .mockResolvedValueOnce({ mileage: 55000 });

    const res = await request(app)
      .get('/api/v1/fuel-records/stats')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalCost');
    expect(res.body).toHaveProperty('totalLiters');
    expect(res.body).toHaveProperty('averageKmPerLiter');
    expect(res.body).toHaveProperty('anomalyCount');
  });

  // ── GET /fuel-records/ranking ────────────────────────────────────────────

  it('GET /fuel-records/ranking returns best/worst vehicle ranking', async () => {
    prisma.fuelRecord.groupBy.mockResolvedValue([
      {
        vehicleId: VEHICLE.id,
        _avg: { kmPerLiter: 12.5 },
        _count: { id: 5 },
        _sum: { totalCost: 1340, liters: 227.5 },
      },
    ]);
    prisma.vehicle.findMany.mockResolvedValue([VEHICLE]);

    const res = await request(app)
      .get('/api/v1/fuel-records/ranking')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('best');
    expect(res.body).toHaveProperty('worst');
  });
});
