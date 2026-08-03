import jwt from 'jsonwebtoken';
import request from 'supertest';
import {
  AIReportKind,
  AIReportStatus,
  PlanType,
  TenantStatus,
  UserRole,
} from '@frota-leve/database';
import { createApp } from '../../app';
import { authCache } from '../auth/auth.cache';

/**
 * Cobre as rotas de OCR, relatórios e scoring montadas no aiRouter (TASK 3.5–3.7).
 * O foco é a borda HTTP: autenticação, role, validação e escopo por tenant.
 */

type MockPrisma = {
  tenant: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
  user: { findUnique: jest.Mock; findMany: jest.Mock };
  aIReport: { count: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock };
  driver: { count: jest.Mock; findMany: jest.Mock };
  driverScore: { findMany: jest.Mock };
};

jest.mock('../../middlewares/ai-feature-flag', () => ({
  aiFeatureFlag: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

jest.mock('../../config/database', () => ({
  prisma: {
    tenant: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    aIReport: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    driver: { count: jest.fn(), findMany: jest.fn() },
    driverScore: { findMany: jest.fn() },
  },
}));

jest.mock('@frota-leve/ai', () => ({
  ocrService: { extract: jest.fn() },
  reportService: { generateMonthly: jest.fn() },
  scoringService: { recommend: jest.fn() },
  computeDriverScore: jest.fn(() => ({ score: 90, breakdown: {} })),
  shouldGenerateRecommendation: jest.fn(() => false),
  OcrValidationError: class extends Error {},
}));

const databaseMock = jest.requireMock('../../config/database') as { prisma: MockPrisma };
const aiMock = jest.requireMock('@frota-leve/ai') as {
  ocrService: { extract: jest.Mock };
  reportService: { generateMonthly: jest.Mock };
};

const prismaMock = databaseMock.prisma;

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const REPORT_ID = '33333333-3333-4333-8333-333333333333';
const DRIVER_ID = '44444444-4444-4444-8444-444444444444';

function createUser(role: UserRole) {
  return { id: USER_ID, tenantId: TENANT_ID, role, email: 'u@e.com', isActive: true };
}

function token(user: ReturnType<typeof createUser>): string {
  return jwt.sign(
    { tenantId: user.tenantId, role: user.role, email: user.email, type: 'access' },
    process.env['JWT_SECRET'] as string,
    { subject: user.id, expiresIn: '15m', jwtid: '66666666-6666-4666-8666-666666666666' },
  );
}

describe('rotas de IA (OCR, relatórios, scoring)', () => {
  let app: ReturnType<typeof createApp>;
  let owner: ReturnType<typeof createUser>;

  beforeEach(() => {
    app = createApp();
    authCache.clear();
    jest.clearAllMocks();

    owner = createUser(UserRole.OWNER);
    prismaMock.user.findUnique.mockResolvedValue(owner);
    prismaMock.tenant.findUnique.mockResolvedValue({
      id: TENANT_ID,
      name: 'Empresa',
      plan: PlanType.ENTERPRISE,
      status: TenantStatus.ACTIVE,
      trialEndsAt: null,
      settings: {},
    });
  });

  describe('OCR', () => {
    it('extrai dados do cupom enviado', async () => {
      aiMock.ocrService.extract.mockResolvedValue({
        data: { liters: 40, totalCost: 300, confidence: 0.9, fieldsConfidence: {} },
        confidence: 0.9,
      });

      const response = await request(app)
        .post('/api/v1/ai/ocr/fuel')
        .set('Authorization', `Bearer ${token(owner)}`)
        .attach('image', Buffer.from('fake-jpeg'), {
          filename: 'cupom.jpg',
          contentType: 'image/jpeg',
        });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({ confidence: 0.9 });
      expect(aiMock.ocrService.extract.mock.calls[0]?.[0]).toMatchObject({
        tenantId: TENANT_ID,
        kind: 'fuel',
      });
    });

    it('recusa requisição sem imagem', async () => {
      const response = await request(app)
        .post('/api/v1/ai/ocr/fuel')
        .set('Authorization', `Bearer ${token(owner)}`);

      expect(response.status).toBe(400);
      expect(aiMock.ocrService.extract).not.toHaveBeenCalled();
    });

    it('recusa arquivo que não é imagem', async () => {
      const response = await request(app)
        .post('/api/v1/ai/ocr/invoice')
        .set('Authorization', `Bearer ${token(owner)}`)
        .attach('image', Buffer.from('texto'), {
          filename: 'nota.txt',
          contentType: 'text/plain',
        });

      expect(response.status).toBe(400);
    });

    it('exige autenticação', async () => {
      const response = await request(app).post('/api/v1/ai/ocr/fuel');

      expect(response.status).toBe(401);
    });
  });

  describe('Relatórios', () => {
    it('lista escopado por tenant', async () => {
      prismaMock.aIReport.count.mockResolvedValue(1);
      prismaMock.aIReport.findMany.mockResolvedValue([
        {
          id: REPORT_ID,
          period: '2026-07',
          kind: AIReportKind.MONTHLY,
          summary: 'resumo',
          status: AIReportStatus.GENERATED,
          generatedAt: new Date(),
          createdAt: new Date(),
        },
      ]);

      const response = await request(app)
        .get('/api/v1/ai/reports')
        .set('Authorization', `Bearer ${token(owner)}`);

      expect(response.status).toBe(200);
      expect(prismaMock.aIReport.findMany.mock.calls[0]?.[0]?.where).toMatchObject({
        tenantId: TENANT_ID,
      });
    });

    it('devolve 404 para relatório de outro tenant', async () => {
      prismaMock.aIReport.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/v1/ai/reports/${REPORT_ID}`)
        .set('Authorization', `Bearer ${token(owner)}`);

      expect(response.status).toBe(404);
    });

    it('gera o PDF do relatório', async () => {
      prismaMock.aIReport.findFirst.mockResolvedValue({
        id: REPORT_ID,
        period: '2026-07',
        summary: 'resumo',
        content: '## Resumo Executivo\nTexto.',
      });

      const response = await request(app)
        .get(`/api/v1/ai/reports/${REPORT_ID}/pdf`)
        .set('Authorization', `Bearer ${token(owner)}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.body.subarray(0, 5).toString()).toBe('%PDF-');
    });

    it('recusa período fora do formato na geração sob demanda', async () => {
      const response = await request(app)
        .post('/api/v1/ai/reports/on-demand')
        .set('Authorization', `Bearer ${token(owner)}`)
        .send({ period: 'julho' });

      expect(response.status).toBe(400);
      expect(aiMock.reportService.generateMonthly).not.toHaveBeenCalled();
    });

    it('bloqueia geração sob demanda para role sem permissão', async () => {
      const viewer = createUser(UserRole.VIEWER);
      prismaMock.user.findUnique.mockResolvedValue(viewer);

      const response = await request(app)
        .post('/api/v1/ai/reports/on-demand')
        .set('Authorization', `Bearer ${token(viewer)}`)
        .send({ period: '2026-07' });

      expect(response.status).toBe(403);
    });
  });

  describe('Scoring', () => {
    it('devolve o ranking escopado por tenant', async () => {
      prismaMock.driver.count.mockResolvedValue(0);
      prismaMock.driver.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/v1/ai/scoring/ranking')
        .set('Authorization', `Bearer ${token(owner)}`);

      expect(response.status).toBe(200);
      expect(prismaMock.driver.findMany.mock.calls[0]?.[0]?.where).toMatchObject({
        tenantId: TENANT_ID,
      });
    });

    it('devolve o histórico do motorista', async () => {
      prismaMock.driverScore.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/v1/ai/scoring/drivers/${DRIVER_ID}`)
        .set('Authorization', `Bearer ${token(owner)}`);

      expect(response.status).toBe(200);
      expect(prismaMock.driverScore.findMany.mock.calls[0]?.[0]?.where).toMatchObject({
        tenantId: TENANT_ID,
        driverId: DRIVER_ID,
      });
    });

    it('recusa id de motorista inválido', async () => {
      const response = await request(app)
        .get('/api/v1/ai/scoring/drivers/nao-e-uuid')
        .set('Authorization', `Bearer ${token(owner)}`);

      expect(response.status).toBe(400);
    });
  });
});
