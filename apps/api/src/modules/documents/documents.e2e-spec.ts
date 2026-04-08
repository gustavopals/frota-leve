import jwt from 'jsonwebtoken';
import request from 'supertest';
import {
  DocumentStatus,
  DocumentType,
  PlanType,
  TenantStatus,
  UserRole,
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
};

type MockDriver = {
  id: string;
  tenantId: string;
  name: string;
  cpf: string;
  cnhNumber: string | null;
};

type MockDocument = {
  id: string;
  tenantId: string;
  vehicleId: string | null;
  driverId: string | null;
  type: DocumentType;
  description: string;
  expirationDate: Date;
  alertDaysBefore: number;
  cost: number | null;
  fileUrl: string;
  status: DocumentStatus;
  notes: string | null;
  createdAt: Date;
};

type MockTransactionClient = {
  document: {
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  auditLog: {
    create: jest.Mock;
  };
};

type MockPrisma = {
  tenant: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock; findFirst: jest.Mock };
  vehicle: { findFirst: jest.Mock };
  driver: { findFirst: jest.Mock };
  document: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    count: jest.Mock;
  };
  $transaction: jest.Mock;
  $executeRaw: jest.Mock;
};

jest.mock('../../config/database', () => ({
  prisma: {
    tenant: { findUnique: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn() },
    vehicle: { findFirst: jest.fn() },
    driver: { findFirst: jest.fn() },
    document: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
  },
}));

const prisma = prismaClient as unknown as MockPrisma;

const TENANT: MockTenant = {
  id: 'aaaaaaaa-0000-0000-0000-000000000011',
  name: 'Tenant Docs',
  plan: PlanType.PROFESSIONAL,
  status: TenantStatus.ACTIVE,
  trialEndsAt: null,
};

const OWNER: MockUser = {
  id: 'bbbbbbbb-0000-0000-0000-000000000011',
  tenantId: TENANT.id,
  role: UserRole.OWNER,
  email: 'owner@docs.com',
  isActive: true,
};

const VIEWER: MockUser = {
  id: 'bbbbbbbb-0000-0000-0000-000000000012',
  tenantId: TENANT.id,
  role: UserRole.VIEWER,
  email: 'viewer@docs.com',
  isActive: true,
};

const VEHICLE: MockVehicle = {
  id: 'cccccccc-0000-0000-0000-000000000011',
  tenantId: TENANT.id,
  plate: 'ABC1234',
  brand: 'Mercedes',
  model: 'Sprinter',
  year: 2024,
};

const DRIVER: MockDriver = {
  id: 'dddddddd-0000-0000-0000-000000000011',
  tenantId: TENANT.id,
  name: 'Maria Souza',
  cpf: '12345678901',
  cnhNumber: '12345678900',
};

const VALID_DOCUMENT: MockDocument = {
  id: 'eeeeeeee-0000-0000-0000-000000000011',
  tenantId: TENANT.id,
  vehicleId: VEHICLE.id,
  driverId: null,
  type: DocumentType.IPVA,
  description: 'IPVA 2026',
  expirationDate: new Date('2099-05-10T00:00:00Z'),
  alertDaysBefore: 30,
  cost: 1250,
  fileUrl: 'https://files.example.com/documents/ipva-2026.pdf',
  status: DocumentStatus.VALID,
  notes: 'Pago em cota única',
  createdAt: new Date('2026-04-08T12:00:00Z'),
};

const EXPIRING_DOCUMENT: MockDocument = {
  id: 'eeeeeeee-0000-0000-0000-000000000012',
  tenantId: TENANT.id,
  vehicleId: null,
  driverId: DRIVER.id,
  type: DocumentType.CNH,
  description: 'CNH da Maria',
  expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  alertDaysBefore: 15,
  cost: null,
  fileUrl: 'https://files.example.com/documents/cnh-maria.pdf',
  status: DocumentStatus.EXPIRING,
  notes: null,
  createdAt: new Date('2026-04-08T12:00:00Z'),
};

const VALID_DOCUMENT_WITH_RELATIONS = {
  ...VALID_DOCUMENT,
  vehicle: { ...VEHICLE },
  driver: null,
};

const EXPIRING_DOCUMENT_WITH_RELATIONS = {
  ...EXPIRING_DOCUMENT,
  vehicle: null,
  driver: { ...DRIVER },
};

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
      jwtid: 'ffffeeee-0000-4000-8000-000000000011',
    },
  );
}

function setupDefaultMocks() {
  prisma.tenant.findUnique.mockResolvedValue(TENANT);
  prisma.user.findUnique.mockResolvedValue(OWNER);
  prisma.user.findFirst.mockResolvedValue(OWNER);
  prisma.vehicle.findFirst.mockResolvedValue(VEHICLE);
  prisma.driver.findFirst.mockResolvedValue(DRIVER);
  prisma.document.findMany.mockResolvedValue([VALID_DOCUMENT_WITH_RELATIONS]);
  prisma.document.findFirst.mockResolvedValue(VALID_DOCUMENT_WITH_RELATIONS);
  prisma.document.count.mockResolvedValue(1);
  prisma.$executeRaw.mockResolvedValue(1);
}

const BASE_PAYLOAD = {
  vehicleId: VEHICLE.id,
  type: DocumentType.IPVA,
  description: 'IPVA 2027',
  expirationDate: '2099-06-15T00:00:00Z',
  alertDaysBefore: 45,
  cost: 1450,
  fileUrl: 'https://files.example.com/documents/ipva-2027.pdf',
  notes: 'Renovar com antecedência',
};

describe('Documents E2E', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
    setupDefaultMocks();
  });

  it('GET /documents returns paginated list', async () => {
    const res = await request(app)
      .get('/api/v1/documents')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({
      id: VALID_DOCUMENT.id,
      status: DocumentStatus.VALID,
      vehicleId: VEHICLE.id,
    });
    expect(res.body.meta).toMatchObject({ page: 1, total: 1 });
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('GET /documents filters by status', async () => {
    prisma.document.findMany.mockResolvedValue([EXPIRING_DOCUMENT_WITH_RELATIONS]);
    prisma.document.count.mockResolvedValue(1);

    const res = await request(app)
      .get(`/api/v1/documents?status=${DocumentStatus.EXPIRING}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({
      id: EXPIRING_DOCUMENT.id,
      status: DocumentStatus.EXPIRING,
      driverId: DRIVER.id,
    });
  });

  it('GET /documents/:id returns a single document', async () => {
    const res = await request(app)
      .get(`/api/v1/documents/${VALID_DOCUMENT.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: VALID_DOCUMENT.id,
      vehicle: { plate: VEHICLE.plate },
      status: DocumentStatus.VALID,
    });
  });

  it('GET /documents/pending agrupa documentos nas janelas de 30/60/90 dias', async () => {
    const doc30 = {
      ...EXPIRING_DOCUMENT_WITH_RELATIONS,
      id: 'pending-30',
      type: DocumentType.CNH,
      expirationDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      alertDaysBefore: 15,
    };
    const doc60 = {
      ...VALID_DOCUMENT_WITH_RELATIONS,
      id: 'pending-60',
      type: DocumentType.IPVA,
      expirationDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      alertDaysBefore: 10,
      status: DocumentStatus.VALID,
    };
    const doc90 = {
      ...VALID_DOCUMENT_WITH_RELATIONS,
      id: 'pending-90',
      type: DocumentType.LICENSING,
      expirationDate: new Date(Date.now() + 80 * 24 * 60 * 60 * 1000),
      alertDaysBefore: 5,
      status: DocumentStatus.VALID,
    };
    const doc120 = {
      ...VALID_DOCUMENT_WITH_RELATIONS,
      id: 'pending-120',
      expirationDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
      alertDaysBefore: 10,
      status: DocumentStatus.VALID,
    };

    prisma.document.findMany.mockResolvedValue([doc30, doc60, doc90, doc120]);

    const res = await request(app)
      .get('/api/v1/documents/pending')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({
      upTo30Days: 1,
      upTo60Days: 2,
      upTo90Days: 3,
      total: 3,
    });
    expect(res.body.buckets.upTo30Days).toHaveLength(1);
    expect(res.body.buckets.days31To60).toHaveLength(1);
    expect(res.body.buckets.days61To90).toHaveLength(1);
    expect(res.body.buckets.upTo30Days[0]).toMatchObject({
      id: 'pending-30',
      bucket: 'upTo30Days',
    });
    expect(res.body.buckets.days31To60[0]).toMatchObject({
      id: 'pending-60',
      bucket: 'days31To60',
      status: DocumentStatus.VALID,
    });
    expect(res.body.buckets.days61To90[0]).toMatchObject({
      id: 'pending-90',
      bucket: 'days61To90',
    });
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('GET /documents/pending aplica filtros por tipo, veículo e motorista', async () => {
    prisma.document.findMany.mockResolvedValue([EXPIRING_DOCUMENT_WITH_RELATIONS]);

    const res = await request(app)
      .get(
        `/api/v1/documents/pending?type=${DocumentType.CNH}&driverId=${DRIVER.id}&vehicleId=${VEHICLE.id}`,
      )
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT.id,
          type: DocumentType.CNH,
          driverId: DRIVER.id,
          vehicleId: VEHICLE.id,
        }),
      }),
    );
  });

  it('POST /documents creates a document and returns 201', async () => {
    const txMock: MockTransactionClient = {
      document: {
        create: jest.fn().mockResolvedValue({
          ...VALID_DOCUMENT_WITH_RELATIONS,
          ...VALID_DOCUMENT,
          description: BASE_PAYLOAD.description,
          fileUrl: BASE_PAYLOAD.fileUrl,
        }),
        update: jest.fn(),
        delete: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prisma.$transaction.mockImplementation((fn: (tx: MockTransactionClient) => Promise<unknown>) =>
      fn(txMock),
    );

    const res = await request(app)
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      description: BASE_PAYLOAD.description,
      fileUrl: BASE_PAYLOAD.fileUrl,
      status: DocumentStatus.VALID,
    });
    expect(txMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'DOCUMENT_CREATED' }),
      }),
    );
  });

  it('POST /documents returns 400 when vínculo não é informado', async () => {
    const { vehicleId: _vehicleId, ...payloadWithoutTarget } = BASE_PAYLOAD;

    const res = await request(app)
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send(payloadWithoutTarget);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /documents returns 403 for VIEWER role', async () => {
    prisma.user.findUnique.mockResolvedValue(VIEWER);
    prisma.user.findFirst.mockResolvedValue(VIEWER);

    const res = await request(app)
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${makeToken(VIEWER)}`)
      .send(BASE_PAYLOAD);

    expect(res.status).toBe(403);
  });

  it('PUT /documents/:id updates a document', async () => {
    const txMock: MockTransactionClient = {
      document: {
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({
          ...VALID_DOCUMENT_WITH_RELATIONS,
          ...VALID_DOCUMENT,
          description: 'IPVA 2026 quitado',
          cost: 1300,
        }),
        delete: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prisma.$transaction.mockImplementation((fn: (tx: MockTransactionClient) => Promise<unknown>) =>
      fn(txMock),
    );
    prisma.document.findFirst.mockResolvedValue(VALID_DOCUMENT);

    const res = await request(app)
      .put(`/api/v1/documents/${VALID_DOCUMENT.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`)
      .send({
        ...BASE_PAYLOAD,
        description: 'IPVA 2026 quitado',
        cost: 1300,
      });

    expect(res.status).toBe(200);
    expect(res.body.description).toBe('IPVA 2026 quitado');
    expect(txMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'DOCUMENT_UPDATED' }),
      }),
    );
  });

  it('DELETE /documents/:id deletes a document', async () => {
    const txMock: MockTransactionClient = {
      document: {
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn().mockResolvedValue(VALID_DOCUMENT),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    prisma.$transaction.mockImplementation((fn: (tx: MockTransactionClient) => Promise<unknown>) =>
      fn(txMock),
    );
    prisma.document.findFirst.mockResolvedValue(VALID_DOCUMENT);

    const res = await request(app)
      .delete(`/api/v1/documents/${VALID_DOCUMENT.id}`)
      .set('Authorization', `Bearer ${makeToken(OWNER)}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ deleted: true, documentId: VALID_DOCUMENT.id });
    expect(txMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'DOCUMENT_DELETED' }),
      }),
    );
  });
});
