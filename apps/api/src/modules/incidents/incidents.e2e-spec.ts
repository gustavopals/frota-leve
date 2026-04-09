import jwt from 'jsonwebtoken';
import request from 'supertest';
import { PlanType, TenantStatus, UserRole, VehicleStatus } from '@frota-leve/database';
import { IncidentStatus, IncidentType } from '@frota-leve/shared';
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

type MockIncident = {
  id: string;
  tenantId: string;
  vehicleId: string;
  driverId: string | null;
  date: Date;
  location: string;
  type: IncidentType;
  description: string;
  thirdPartyInvolved: boolean;
  policeReport: boolean;
  insurerNotified: boolean;
  insuranceClaimNumber: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  status: IncidentStatus;
  photos: string[] | null;
  documents: string[] | null;
  downtime: number | null;
  notes: string | null;
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
  incident: {
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
    incident: {
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
  id: 'aaaaaaaa-3333-3333-3333-333333333333',
  name: 'Tenant Incidents',
  plan: PlanType.PROFESSIONAL,
  status: TenantStatus.ACTIVE,
  trialEndsAt: null,
};

const OWNER: MockUser = {
  id: 'bbbbbbbb-3333-3333-3333-333333333331',
  tenantId: TENANT.id,
  role: UserRole.OWNER,
  email: 'owner@incidents.com',
  isActive: true,
};

const VIEWER: MockUser = {
  id: 'bbbbbbbb-3333-3333-3333-333333333332',
  tenantId: TENANT.id,
  role: UserRole.VIEWER,
  email: 'viewer@incidents.com',
  isActive: true,
};

const VEHICLE: MockVehicle = {
  id: 'cccccccc-3333-3333-3333-333333333333',
  tenantId: TENANT.id,
  plate: 'ABC1D23',
  brand: 'Volkswagen',
  model: 'Delivery',
  year: 2024,
  currentMileage: 26000,
  status: VehicleStatus.ACTIVE,
};

const DRIVER: MockDriver = {
  id: 'dddddddd-3333-3333-3333-333333333333',
  tenantId: TENANT.id,
  name: 'Marina Souza',
  cpf: '12345678900',
};

const INCIDENT: MockIncident = {
  id: 'eeeeeeee-3333-3333-3333-333333333333',
  tenantId: TENANT.id,
  vehicleId: VEHICLE.id,
  driverId: DRIVER.id,
  date: new Date('2026-04-05T14:00:00.000Z'),
  location: 'Marginal Tietê, km 12 - São Paulo/SP',
  type: IncidentType.COLLISION,
  description: 'Colisão traseira com avaria no para-choque e lanterna.',
  thirdPartyInvolved: true,
  policeReport: true,
  insurerNotified: true,
  insuranceClaimNumber: 'CLAIM-2026-0042',
  estimatedCost: 4200,
  actualCost: 3980,
  status: IncidentStatus.REGISTERED,
  photos: ['https://files.example.com/incidents/photo-1.jpg'],
  documents: ['https://files.example.com/incidents/boletim.pdf'],
  downtime: 4,
  notes: 'Veículo removido para oficina credenciada.',
  createdAt: new Date('2026-04-05T16:00:00.000Z'),
  updatedAt: new Date('2026-04-05T16:00:00.000Z'),
  vehicle: VEHICLE,
  driver: DRIVER,
};

const BASE_PAYLOAD = {
  vehicleId: VEHICLE.id,
  driverId: DRIVER.id,
  date: '2026-04-05T14:00:00.000Z',
  location: 'Marginal Tietê, km 12 - São Paulo/SP',
  type: IncidentType.COLLISION,
  description: 'Colisão traseira com avaria no para-choque e lanterna.',
  thirdPartyInvolved: true,
  policeReport: true,
  insurerNotified: true,
  insuranceClaimNumber: 'CLAIM-2026-0042',
  estimatedCost: 4200,
  actualCost: 3980,
  photos: ['https://files.example.com/incidents/photo-1.jpg'],
  documents: ['https://files.example.com/incidents/boletim.pdf'],
  downtime: 4,
  notes: 'Veículo removido para oficina credenciada.',
};

function makeToken(user: MockUser) {
  return jwt.sign(
    { tenantId: user.tenantId, role: user.role, email: user.email, type: 'access' },
    process.env['JWT_SECRET'] ?? 'test-secret',
    { subject: user.id, expiresIn: '1h', jwtid: 'incidents-access-token' },
  );
}

function setupDefaultMocks() {
  prisma.tenant.findUnique.mockResolvedValue(TENANT);
  prisma.user.findUnique.mockResolvedValue(OWNER);
  prisma.user.findFirst.mockResolvedValue(OWNER);
  prisma.vehicle.findFirst.mockResolvedValue(VEHICLE);
  prisma.driver.findFirst.mockResolvedValue(DRIVER);
  prisma.incident.findMany.mockResolvedValue([INCIDENT]);
  prisma.incident.findFirst.mockResolvedValue(INCIDENT);
  prisma.incident.count.mockResolvedValue(1);
  prisma.auditLog.count.mockResolvedValue(1);
}

type MockTxClient = {
  incident: { create: jest.Mock; update: jest.Mock; delete: jest.Mock };
  auditLog: { create: jest.Mock; deleteMany: jest.Mock };
};

describe('Incidents E2E', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it('GET /incidents returns paginated list', async () => {
    const res = await request(app)
      .get('/api/v1/incidents')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      id: INCIDENT.id,
      status: IncidentStatus.REGISTERED,
      vehicleId: VEHICLE.id,
    });
    expect(res.body.meta).toMatchObject({ page: 1, total: 1 });
  });

  it('GET /incidents/:id returns an incident', async () => {
    const res = await request(app)
      .get(`/api/v1/incidents/${INCIDENT.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(INCIDENT.id);
    expect(res.body.location).toBe(INCIDENT.location);
  });

  it('POST /incidents creates an incident with REGISTERED status', async () => {
    const txMock: MockTxClient = {
      incident: {
        create: jest.fn().mockResolvedValue(INCIDENT),
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
      .post('/api/v1/incidents')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe(IncidentStatus.REGISTERED);
    expect(txMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'INCIDENT_CREATED' }),
      }),
    );
  });

  it('POST /incidents returns 403 for VIEWER role', async () => {
    prisma.user.findUnique.mockResolvedValue(VIEWER);
    prisma.user.findFirst.mockResolvedValue(VIEWER);

    const res = await request(app)
      .post('/api/v1/incidents')
      .set('Authorization', `Bearer ${makeToken(VIEWER)}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(403);
  });

  it('PUT /incidents/:id transitions REGISTERED -> UNDER_ANALYSIS', async () => {
    const updated = {
      ...INCIDENT,
      status: IncidentStatus.UNDER_ANALYSIS,
    };
    const txMock: MockTxClient = {
      incident: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(updated),
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
      .put(`/api/v1/incidents/${INCIDENT.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({ ...BASE_PAYLOAD, status: IncidentStatus.UNDER_ANALYSIS });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(IncidentStatus.UNDER_ANALYSIS);
  });

  it('PUT /incidents/:id rejects invalid transition CONCLUDED -> REGISTERED', async () => {
    prisma.incident.findFirst.mockResolvedValue({ ...INCIDENT, status: IncidentStatus.CONCLUDED });

    const res = await request(app)
      .put(`/api/v1/incidents/${INCIDENT.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({ ...BASE_PAYLOAD, status: IncidentStatus.REGISTERED });

    expect(res.status).toBe(400);
  });

  it('GET /incidents/stats returns summary metrics', async () => {
    prisma.incident.findMany.mockResolvedValue([
      INCIDENT,
      {
        ...INCIDENT,
        id: 'ffffffff-3333-3333-3333-333333333333',
        type: IncidentType.THEFT,
        status: IncidentStatus.CONCLUDED,
        actualCost: 6000,
        estimatedCost: 6500,
        downtime: 7,
        date: new Date('2026-04-07T10:00:00.000Z'),
      },
    ]);

    const res = await request(app)
      .get('/api/v1/incidents/stats')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({
      total: 2,
      totalActualCost: 9980,
      totalDowntime: 11,
    });
    expect(res.body.byType).toHaveLength(2);
  });

  it('DELETE /incidents/:id performs hard delete when only creation audit exists', async () => {
    prisma.auditLog.count.mockResolvedValue(1);
    const txMock: MockTxClient = {
      incident: {
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
      .delete(`/api/v1/incidents/${INCIDENT.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ deleted: true, mode: 'hard', incidentId: INCIDENT.id });
  });

  it('DELETE /incidents/:id rejects non-REGISTERED incident', async () => {
    prisma.incident.findFirst.mockResolvedValue({
      ...INCIDENT,
      status: IncidentStatus.UNDER_ANALYSIS,
    });

    const res = await request(app)
      .delete(`/api/v1/incidents/${INCIDENT.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(400);
  });
});
