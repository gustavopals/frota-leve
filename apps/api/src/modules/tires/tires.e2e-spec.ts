import jwt from 'jsonwebtoken';
import request from 'supertest';
import { PlanType, TenantStatus, UserRole } from '@frota-leve/database';
import { TireStatus } from '@frota-leve/shared';
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
};

type MockTire = {
  id: string;
  tenantId: string;
  brand: string;
  model: string;
  size: string;
  serialNumber: string;
  dot: string;
  status: TireStatus;
  currentVehicleId: string | null;
  position: string | null;
  currentGrooveDepth: number;
  originalGrooveDepth: number;
  retreatCount: number;
  costNew: number;
  costRetreat: number;
  totalKm: number;
  createdAt: Date;
  updatedAt: Date;
  currentVehicle: MockVehicle | null;
};

type MockInspection = {
  id: string;
  tenantId: string;
  tireId: string;
  vehicleId: string;
  inspectedByUserId: string;
  date: Date;
  grooveDepth: number;
  position: string;
  photos: string[] | null;
  notes: string | null;
  createdAt: Date;
  vehicle: MockVehicle;
  inspectedByUser: {
    id: string;
    name: string;
    email: string;
  };
};

type MockPrisma = {
  tenant: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock; findFirst: jest.Mock };
  vehicle: { findFirst: jest.Mock };
  tire: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    count: jest.Mock;
  };
  tireInspection: {
    create: jest.Mock;
    count: jest.Mock;
    findFirst: jest.Mock;
  };
  $transaction: jest.Mock;
};

type MockTxClient = {
  tire: {
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  tireInspection: {
    create: jest.Mock;
  };
  auditLog: {
    create: jest.Mock;
  };
};

jest.mock('../../config/database', () => ({
  prisma: {
    tenant: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    vehicle: { findFirst: jest.fn() },
    tire: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    tireInspection: {
      create: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const prisma = prismaClient as unknown as MockPrisma;

const TENANT: MockTenant = {
  id: 'aaaaaaaa-3333-3333-3333-333333333333',
  name: 'Tenant Tires',
  plan: PlanType.PROFESSIONAL,
  status: TenantStatus.ACTIVE,
  trialEndsAt: null,
};

const OWNER: MockUser = {
  id: 'bbbbbbbb-3333-3333-3333-333333333331',
  tenantId: TENANT.id,
  role: UserRole.OWNER,
  email: 'owner@tires.com',
  isActive: true,
};

const VIEWER: MockUser = {
  id: 'bbbbbbbb-3333-3333-3333-333333333332',
  tenantId: TENANT.id,
  role: UserRole.VIEWER,
  email: 'viewer@tires.com',
  isActive: true,
};

const VEHICLE: MockVehicle = {
  id: 'cccccccc-3333-3333-3333-333333333333',
  tenantId: TENANT.id,
  plate: 'BRA2E19',
  brand: 'Fiat',
  model: 'Strada',
  year: 2025,
};

const FREE_TIRE: MockTire = {
  id: 'dddddddd-3333-3333-3333-333333333333',
  tenantId: TENANT.id,
  brand: 'Pirelli',
  model: 'Chrono',
  size: '195/65 R15',
  serialNumber: 'PNEU-0001',
  dot: '1426',
  status: TireStatus.NEW,
  currentVehicleId: null,
  position: null,
  currentGrooveDepth: 8,
  originalGrooveDepth: 8,
  retreatCount: 0,
  costNew: 580,
  costRetreat: 0,
  totalKm: 0,
  createdAt: new Date('2026-04-08T12:00:00.000Z'),
  updatedAt: new Date('2026-04-08T12:00:00.000Z'),
  currentVehicle: null,
};

const INSTALLED_TIRE: MockTire = {
  ...FREE_TIRE,
  id: 'dddddddd-3333-3333-3333-333333333334',
  status: TireStatus.IN_USE,
  currentVehicleId: VEHICLE.id,
  position: 'Dianteiro esquerdo',
  currentGrooveDepth: 7.2,
  totalKm: 12400,
  currentVehicle: VEHICLE,
};

const RETREADED_TIRE: MockTire = {
  ...INSTALLED_TIRE,
  id: 'dddddddd-3333-3333-3333-333333333336',
  brand: 'Goodyear',
  model: 'Cargo G28',
  serialNumber: 'PNEU-0003',
  status: TireStatus.RETREADED,
  currentVehicleId: null,
  position: null,
  currentGrooveDepth: 5.4,
  originalGrooveDepth: 8,
  retreatCount: 2,
  costNew: 700,
  costRetreat: 180,
  totalKm: 40000,
  currentVehicle: null,
};

const TIRE_INSPECTION: MockInspection = {
  id: 'eeeeeeee-3333-3333-3333-333333333333',
  tenantId: TENANT.id,
  tireId: INSTALLED_TIRE.id,
  vehicleId: VEHICLE.id,
  inspectedByUserId: OWNER.id,
  date: new Date('2026-04-10T10:00:00.000Z'),
  grooveDepth: 6.8,
  position: 'Dianteiro esquerdo',
  photos: ['https://files.example.com/tires/inspection-1.jpg'],
  notes: 'Desgaste uniforme',
  createdAt: new Date('2026-04-10T10:05:00.000Z'),
  vehicle: VEHICLE,
  inspectedByUser: {
    id: OWNER.id,
    name: 'Owner Tires',
    email: OWNER.email,
  },
};

const BASE_PAYLOAD = {
  brand: 'Pirelli',
  model: 'Chrono',
  size: '195/65 R15',
  serialNumber: 'PNEU-0001',
  dot: '1426',
  status: TireStatus.NEW,
  currentGrooveDepth: 8,
  originalGrooveDepth: 8,
  retreatCount: 0,
  costNew: 580,
  costRetreat: 0,
  totalKm: 0,
};

function makeToken(user: MockUser) {
  return jwt.sign(
    { tenantId: user.tenantId, role: user.role, email: user.email, type: 'access' },
    process.env['JWT_SECRET'] ?? 'test-secret',
    { subject: user.id, expiresIn: '1h', jwtid: 'tires-access-token' },
  );
}

function setupDefaultMocks() {
  prisma.tenant.findUnique.mockResolvedValue(TENANT);
  prisma.user.findUnique.mockResolvedValue(OWNER);
  prisma.user.findFirst.mockResolvedValue(OWNER);
  prisma.vehicle.findFirst.mockResolvedValue(VEHICLE);
  prisma.tire.findMany.mockResolvedValue([FREE_TIRE]);
  prisma.tire.findFirst.mockResolvedValue(FREE_TIRE);
  prisma.tire.count.mockResolvedValue(1);
  prisma.tireInspection.create.mockResolvedValue(TIRE_INSPECTION);
  prisma.tireInspection.count.mockResolvedValue(0);
  prisma.tireInspection.findFirst.mockResolvedValue(null);
}

describe('Tires E2E', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it('GET /tires returns paginated list', async () => {
    const res = await request(app)
      .get('/api/v1/tires')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      id: FREE_TIRE.id,
      status: TireStatus.NEW,
      serialNumber: FREE_TIRE.serialNumber,
    });
    expect(res.body.meta).toMatchObject({ page: 1, total: 1 });
  });

  it('GET /tires/alerts returns tires below the configured threshold', async () => {
    prisma.tire.findMany.mockResolvedValueOnce([
      {
        ...INSTALLED_TIRE,
        currentGrooveDepth: 2.4,
        updatedAt: new Date('2026-04-11T09:30:00.000Z'),
      },
      {
        ...INSTALLED_TIRE,
        id: 'dddddddd-3333-3333-3333-333333333335',
        serialNumber: 'PNEU-0002',
        currentGrooveDepth: 2.8,
        position: 'Traseiro direito',
        updatedAt: new Date('2026-04-11T10:00:00.000Z'),
      },
    ]);

    const res = await request(app)
      .get(`/api/v1/tires/alerts?vehicleId=${VEHICLE.id}&threshold=3`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({
      total: 2,
      threshold: 3,
      lowestGrooveDepth: 2.4,
      averageGrooveDepth: 2.6,
    });
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({
      currentVehicleId: VEHICLE.id,
      currentGrooveDepth: 2.4,
      mmBelowThreshold: 0.6,
      remainingUsefulLifePercentage: 30,
    });
  });

  it('GET /tires/stats returns cost per km and brand comparison', async () => {
    prisma.tire.findMany.mockResolvedValueOnce([
      {
        ...INSTALLED_TIRE,
        costNew: 600,
        costRetreat: 0,
        totalKm: 12000,
      },
      {
        ...RETREADED_TIRE,
      },
      {
        ...FREE_TIRE,
        id: 'dddddddd-3333-3333-3333-333333333337',
        brand: 'Pirelli',
        serialNumber: 'PNEU-0004',
        costNew: 620,
      },
    ]);

    const res = await request(app)
      .get('/api/v1/tires/stats?brandLimit=5')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({
      totalTires: 3,
      tiresWithKm: 2,
      tiresWithoutKm: 1,
      totalKm: 52000,
      totalCost: 2280,
      averageCostPerKm: 0.03,
      averageCostPerThousandKm: 31.92,
      bestBrand: 'Goodyear',
      worstBrand: 'Pirelli',
    });
    expect(res.body.byTire).toHaveLength(3);
    expect(res.body.byTire[0]).toMatchObject({
      brand: 'Goodyear',
      totalCost: 1060,
      retreatInvestment: 360,
      costPerKm: 0.03,
      costPerThousandKm: 26.5,
    });
    expect(res.body.byBrand).toEqual([
      expect.objectContaining({
        brand: 'Goodyear',
        tireCount: 1,
        tiresWithKm: 1,
        totalKm: 40000,
        totalCost: 1060,
        averageCostPerKm: 0.03,
      }),
      expect.objectContaining({
        brand: 'Pirelli',
        tireCount: 2,
        tiresWithKm: 1,
        totalKm: 12000,
        totalCost: 1220,
        averageCostPerKm: 0.05,
      }),
    ]);
  });

  it('GET /tires/:id returns a tire', async () => {
    const res = await request(app)
      .get(`/api/v1/tires/${FREE_TIRE.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: FREE_TIRE.id,
      status: TireStatus.NEW,
      currentVehicleId: null,
    });
  });

  it('POST /tires creates a tire', async () => {
    prisma.tire.findFirst.mockResolvedValueOnce(null);

    const txMock: MockTxClient = {
      tire: {
        create: jest.fn().mockResolvedValue(FREE_TIRE),
        update: jest.fn(),
        delete: jest.fn(),
      },
      tireInspection: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTxClient) => Promise<unknown>) =>
      fn(txMock),
    );

    const res = await request(app)
      .post('/api/v1/tires')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(TireStatus.NEW);
    expect(txMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'TIRE_CREATED' }),
      }),
    );
  });

  it('POST /tires returns 400 for tire in use without vehicle and position', async () => {
    const res = await request(app)
      .post('/api/v1/tires')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({
        ...BASE_PAYLOAD,
        status: TireStatus.IN_USE,
      });

    expect(res.status).toBe(400);
  });

  it('POST /tires returns 403 for VIEWER role', async () => {
    prisma.user.findUnique.mockResolvedValue(VIEWER);
    prisma.user.findFirst.mockResolvedValue(VIEWER);

    const res = await request(app)
      .post('/api/v1/tires')
      .set('Authorization', `Bearer ${makeToken(VIEWER)}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(403);
  });

  it('PUT /tires/:id transitions NEW -> IN_USE', async () => {
    prisma.tire.findFirst
      .mockResolvedValueOnce(FREE_TIRE)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const txMock: MockTxClient = {
      tire: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(INSTALLED_TIRE),
        delete: jest.fn(),
      },
      tireInspection: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTxClient) => Promise<unknown>) =>
      fn(txMock),
    );

    const res = await request(app)
      .put(`/api/v1/tires/${FREE_TIRE.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({
        ...BASE_PAYLOAD,
        status: TireStatus.IN_USE,
        currentVehicleId: VEHICLE.id,
        position: 'Dianteiro esquerdo',
        currentGrooveDepth: 7.2,
        totalKm: 12400,
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(TireStatus.IN_USE);
    expect(res.body.currentVehicleId).toBe(VEHICLE.id);
    expect(res.body.position).toBe('Dianteiro esquerdo');
  });

  it('PUT /tires/:id rejects invalid transition from DISCARDED to IN_USE', async () => {
    prisma.tire.findFirst.mockResolvedValueOnce({
      ...FREE_TIRE,
      status: TireStatus.DISCARDED,
    });

    const res = await request(app)
      .put(`/api/v1/tires/${FREE_TIRE.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({
        ...BASE_PAYLOAD,
        status: TireStatus.IN_USE,
        currentVehicleId: VEHICLE.id,
        position: 'Dianteiro esquerdo',
        currentGrooveDepth: 6.8,
        totalKm: 22000,
      });

    expect(res.status).toBe(400);
  });

  it('PATCH /tires/:id/move moves tire to another vehicle position', async () => {
    prisma.tire.findFirst
      .mockResolvedValueOnce({
        ...INSTALLED_TIRE,
        currentVehicleId: VEHICLE.id,
        position: 'Dianteiro esquerdo',
      })
      .mockResolvedValueOnce(null);

    const movedTire = {
      ...INSTALLED_TIRE,
      currentVehicleId: VEHICLE.id,
      position: 'Traseiro direito',
      updatedAt: new Date('2026-04-11T09:00:00.000Z'),
    };

    const txMock: MockTxClient = {
      tire: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(movedTire),
        delete: jest.fn(),
      },
      tireInspection: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTxClient) => Promise<unknown>) =>
      fn(txMock),
    );

    const res = await request(app)
      .patch(`/api/v1/tires/${INSTALLED_TIRE.id}/move`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({
        vehicleId: VEHICLE.id,
        position: 'Traseiro direito',
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: INSTALLED_TIRE.id,
      status: TireStatus.IN_USE,
      currentVehicleId: VEHICLE.id,
      position: 'Traseiro direito',
    });
    expect(txMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'TIRE_MOVED' }),
      }),
    );
  });

  it('PATCH /tires/:id/move rejects discarded tire', async () => {
    prisma.tire.findFirst.mockResolvedValueOnce({
      ...INSTALLED_TIRE,
      status: TireStatus.DISCARDED,
    });

    const res = await request(app)
      .patch(`/api/v1/tires/${INSTALLED_TIRE.id}/move`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({
        vehicleId: VEHICLE.id,
        position: 'Traseiro direito',
      });

    expect(res.status).toBe(400);
  });

  it('POST /tires/:id/inspections registers inspection and returns wear metrics', async () => {
    prisma.tire.findFirst.mockResolvedValueOnce(INSTALLED_TIRE);
    prisma.tireInspection.findFirst.mockResolvedValueOnce(null);

    const updatedTire = {
      ...INSTALLED_TIRE,
      currentGrooveDepth: 6.8,
      updatedAt: new Date('2026-04-10T10:05:00.000Z'),
    };

    const txMock: MockTxClient = {
      tire: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(updatedTire),
        delete: jest.fn(),
      },
      tireInspection: {
        create: jest.fn().mockResolvedValue(TIRE_INSPECTION),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTxClient) => Promise<unknown>) =>
      fn(txMock),
    );

    const res = await request(app)
      .post(`/api/v1/tires/${INSTALLED_TIRE.id}/inspections`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({
        vehicleId: VEHICLE.id,
        date: '2026-04-10T10:00:00.000Z',
        grooveDepth: 6.8,
        position: 'Dianteiro esquerdo',
        photos: ['https://files.example.com/tires/inspection-1.jpg'],
        notes: 'Desgaste uniforme',
      });

    expect(res.status).toBe(201);
    expect(res.body.inspection).toMatchObject({
      tireId: INSTALLED_TIRE.id,
      grooveDepth: 6.8,
      position: 'Dianteiro esquerdo',
    });
    expect(res.body.wear).toMatchObject({
      previousGrooveDepth: 7.2,
      currentGrooveDepth: 6.8,
      lossSinceLastInspection: 0.4,
      totalLoss: 1.2,
      wearPercentage: 15,
      remainingUsefulLifePercentage: 85,
    });
    expect(res.body.tire).toMatchObject({
      id: INSTALLED_TIRE.id,
      currentGrooveDepth: 6.8,
    });
    expect(txMock.tireInspection.create).toHaveBeenCalled();
  });

  it('POST /tires/:id/inspections rejects tire that is not in use', async () => {
    prisma.tire.findFirst.mockResolvedValueOnce(FREE_TIRE);

    const res = await request(app)
      .post(`/api/v1/tires/${FREE_TIRE.id}/inspections`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({
        vehicleId: VEHICLE.id,
        date: '2026-04-10T10:00:00.000Z',
        grooveDepth: 7.5,
        position: 'Dianteiro esquerdo',
      });

    expect(res.status).toBe(400);
  });

  it('DELETE /tires/:id deletes a free tire without inspection history', async () => {
    prisma.tire.findFirst.mockResolvedValueOnce(FREE_TIRE);
    prisma.tireInspection.count.mockResolvedValueOnce(0);

    const txMock: MockTxClient = {
      tire: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
      tireInspection: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    prisma.$transaction.mockImplementation((fn: (tx: MockTxClient) => Promise<unknown>) =>
      fn(txMock),
    );

    const res = await request(app)
      .delete(`/api/v1/tires/${FREE_TIRE.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ deleted: true, tireId: FREE_TIRE.id });
  });

  it('DELETE /tires/:id rejects tire with inspection history', async () => {
    prisma.tire.findFirst.mockResolvedValueOnce({
      ...FREE_TIRE,
      status: TireStatus.RETREADED,
    });
    prisma.tireInspection.count.mockResolvedValueOnce(2);

    const res = await request(app)
      .delete(`/api/v1/tires/${FREE_TIRE.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(400);
  });
});
