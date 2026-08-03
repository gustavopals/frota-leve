import jwt from 'jsonwebtoken';
import request from 'supertest';
import {
  AIAnomalyKind,
  AIAnomalySeverity,
  AIAnomalyStatus,
  PlanType,
  TenantStatus,
  UserRole,
} from '@frota-leve/database';
import { createApp } from '../../../app';
import { authCache } from '../../auth/auth.cache';

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

type MockPrisma = {
  tenant: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock };
  aIAnomaly: {
    count: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    updateMany: jest.Mock;
  };
};

jest.mock('../../../middlewares/ai-feature-flag', () => ({
  aiFeatureFlag: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../../../config/database', () => ({
  prisma: {
    tenant: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    aIAnomaly: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

const databaseMock = jest.requireMock('../../../config/database') as { prisma: MockPrisma };
const prismaMock = databaseMock.prisma;

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const ANOMALY_ID = '33333333-3333-4333-8333-333333333333';
const VEHICLE_ID = '44444444-4444-4444-8444-444444444444';

function createTenant(): MockTenant {
  return {
    id: TENANT_ID,
    name: 'Empresa IA',
    plan: PlanType.PROFESSIONAL,
    status: TenantStatus.ACTIVE,
    trialEndsAt: null,
  };
}

function createUser(role: UserRole = UserRole.MANAGER): MockUser {
  return {
    id: USER_ID,
    tenantId: TENANT_ID,
    role,
    email: 'gestor@empresa.com',
    isActive: true,
  };
}

function createToken(user: MockUser): string {
  return jwt.sign(
    { tenantId: user.tenantId, role: user.role, email: user.email, type: 'access' },
    process.env['JWT_SECRET'] as string,
    { subject: user.id, expiresIn: '15m', jwtid: '66666666-6666-4666-8666-666666666666' },
  );
}

function createAnomaly(overrides: Record<string, unknown> = {}) {
  return {
    id: ANOMALY_ID,
    tenantId: TENANT_ID,
    kind: AIAnomalyKind.FUEL_DEVIATION,
    severity: AIAnomalySeverity.HIGH,
    entityType: 'vehicle',
    entityId: VEHICLE_ID,
    score: 3.1,
    evidence: { sampleSize: 14 },
    message: 'Consumo fora do padrão.',
    status: AIAnomalyStatus.OPEN,
    detectedAt: new Date('2026-08-01T03:00:00.000Z'),
    acknowledgedAt: null,
    acknowledgedById: null,
    createdAt: new Date('2026-08-01T03:00:00.000Z'),
    updatedAt: new Date('2026-08-01T03:00:00.000Z'),
    ...overrides,
  };
}

describe('AI anomaly endpoints', () => {
  let app: ReturnType<typeof createApp>;
  let user: MockUser;
  let token: string;

  beforeEach(() => {
    app = createApp();
    authCache.clear();
    jest.clearAllMocks();

    user = createUser();
    token = createToken(user);

    prismaMock.user.findUnique.mockResolvedValue(user);
    prismaMock.tenant.findUnique.mockResolvedValue(createTenant());
  });

  it('GET /api/v1/ai/anomalies lista paginado e escopado por tenant', async () => {
    prismaMock.aIAnomaly.count.mockResolvedValue(1);
    prismaMock.aIAnomaly.findMany.mockResolvedValue([createAnomaly()]);

    const response = await request(app)
      .get('/api/v1/ai/anomalies')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(response.body.data).toHaveLength(1);
    expect(prismaMock.aIAnomaly.findMany.mock.calls[0]?.[0]?.where).toMatchObject({
      tenantId: TENANT_ID,
    });
  });

  it('GET /api/v1/ai/anomalies aplica os filtros de status, kind e severity', async () => {
    prismaMock.aIAnomaly.count.mockResolvedValue(0);
    prismaMock.aIAnomaly.findMany.mockResolvedValue([]);

    const response = await request(app)
      .get('/api/v1/ai/anomalies?status=OPEN&kind=MAINT_COST&severity=HIGH&page=2&limit=5')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(prismaMock.aIAnomaly.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        tenantId: TENANT_ID,
        status: AIAnomalyStatus.OPEN,
        kind: AIAnomalyKind.MAINT_COST,
        severity: AIAnomalySeverity.HIGH,
      },
      skip: 5,
      take: 5,
    });
  });

  it('GET /api/v1/ai/anomalies rejeita filtro inválido', async () => {
    const response = await request(app)
      .get('/api/v1/ai/anomalies?status=INEXISTENTE')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
  });

  it('GET /api/v1/ai/anomalies/insights devolve apenas HIGH e MED abertas', async () => {
    prismaMock.aIAnomaly.findMany.mockResolvedValue([createAnomaly()]);

    const response = await request(app)
      .get('/api/v1/ai/anomalies/insights')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(prismaMock.aIAnomaly.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        tenantId: TENANT_ID,
        status: AIAnomalyStatus.OPEN,
        severity: { in: [AIAnomalySeverity.HIGH, AIAnomalySeverity.MED] },
      },
      take: 5,
    });
  });

  it('GET /api/v1/ai/anomalies/vehicle/:id calcula o health score descontando penalidades', async () => {
    prismaMock.aIAnomaly.findMany.mockResolvedValue([
      createAnomaly({ severity: AIAnomalySeverity.HIGH }),
      createAnomaly({ id: 'outra', severity: AIAnomalySeverity.MED }),
    ]);

    const response = await request(app)
      .get(`/api/v1/ai/anomalies/vehicle/${VEHICLE_ID}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    // 100 - 25 (HIGH) - 10 (MED)
    expect(response.body.data).toMatchObject({ vehicleId: VEHICLE_ID, healthScore: 65 });
  });

  it('POST /api/v1/ai/anomalies/:id/acknowledge marca como ACK', async () => {
    prismaMock.aIAnomaly.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.aIAnomaly.findFirst.mockResolvedValue(
      createAnomaly({ status: AIAnomalyStatus.ACK, acknowledgedById: USER_ID }),
    );

    const response = await request(app)
      .post(`/api/v1/ai/anomalies/${ANOMALY_ID}/acknowledge`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: AIAnomalyStatus.ACK });
    expect(prismaMock.aIAnomaly.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { id: ANOMALY_ID, tenantId: TENANT_ID },
      data: { status: AIAnomalyStatus.ACK, acknowledgedById: USER_ID },
    });
  });

  it('POST /api/v1/ai/anomalies/:id/dismiss marca como DISMISSED', async () => {
    prismaMock.aIAnomaly.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.aIAnomaly.findFirst.mockResolvedValue(
      createAnomaly({ status: AIAnomalyStatus.DISMISSED }),
    );

    const response = await request(app)
      .post(`/api/v1/ai/anomalies/${ANOMALY_ID}/dismiss`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: AIAnomalyStatus.DISMISSED });
  });

  it('devolve 404 ao tentar mudar anomalia de outro tenant', async () => {
    prismaMock.aIAnomaly.updateMany.mockResolvedValue({ count: 0 });

    const response = await request(app)
      .post(`/api/v1/ai/anomalies/${ANOMALY_ID}/acknowledge`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(prismaMock.aIAnomaly.findFirst).not.toHaveBeenCalled();
  });

  it('bloqueia acknowledge para role sem permissão', async () => {
    const viewer = createUser(UserRole.VIEWER);
    prismaMock.user.findUnique.mockResolvedValue(viewer);

    const response = await request(app)
      .post(`/api/v1/ai/anomalies/${ANOMALY_ID}/acknowledge`)
      .set('Authorization', `Bearer ${createToken(viewer)}`);

    expect(response.status).toBe(403);
    expect(prismaMock.aIAnomaly.updateMany).not.toHaveBeenCalled();
  });

  it('exige autenticação', async () => {
    const response = await request(app).get('/api/v1/ai/anomalies');

    expect(response.status).toBe(401);
  });
});
