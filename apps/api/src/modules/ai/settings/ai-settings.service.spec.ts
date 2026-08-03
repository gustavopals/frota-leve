import { AIFeature } from '@frota-leve/database';
import { prisma as prismaClient } from '../../../config/database';
import { AiSettingsService, defaultAiFeatures } from './ai-settings.service';

type MockPrisma = {
  tenant: { findUnique: jest.Mock; update: jest.Mock };
  aIUsageLog: { groupBy: jest.Mock; findMany: jest.Mock; count: jest.Mock };
};

jest.mock('../../../config/database', () => ({
  prisma: {
    tenant: { findUnique: jest.fn(), update: jest.fn() },
    aIUsageLog: { groupBy: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  },
}));

const prisma = prismaClient as unknown as MockPrisma;
const TENANT_ID = 'tenant-1';

describe('AiSettingsService.get', () => {
  let service: AiSettingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiSettingsService();
  });

  it('devolve todas as features ligadas quando o tenant nunca configurou', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ settings: null });

    await expect(service.get(TENANT_ID)).resolves.toMatchObject({
      features: defaultAiFeatures(),
      reportRecipients: [],
    });
  });

  it('respeita apenas o que foi explicitamente desligado', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      settings: { ai: { features: { ocr: false } } },
    });

    const settings = await service.get(TENANT_ID);

    expect(settings.features.ocr).toBe(false);
    expect(settings.features.chat).toBe(true);
  });

  it('lança 404 quando o tenant não existe', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);

    await expect(service.get(TENANT_ID)).rejects.toThrow(/não encontrado/i);
  });
});

describe('AiSettingsService.update', () => {
  let service: AiSettingsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiSettingsService();
    prisma.tenant.update.mockResolvedValue({});
  });

  it('preserva as demais chaves de tenant.settings ao gravar', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      settings: { branding: { logo: 'x.png' }, ai: { features: { chat: true } } },
    });

    await service.update(TENANT_ID, { features: { ocr: false } });

    const written = prisma.tenant.update.mock.calls[0]?.[0]?.data?.settings;
    expect(written.branding).toEqual({ logo: 'x.png' });
    expect(written.ai.features.ocr).toBe(false);
    expect(written.ai.features.chat).toBe(true);
  });

  it('faz merge parcial das features sem apagar as demais', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      settings: { ai: { features: { chat: false, ocr: false } } },
    });

    const result = await service.update(TENANT_ID, { features: { chat: true } });

    expect(result.features.chat).toBe(true);
    expect(result.features.ocr).toBe(false);
  });

  it('atualiza destinatários de e-mail', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ settings: {} });

    const result = await service.update(TENANT_ID, {
      reportRecipients: ['gestor@empresa.com'],
    });

    expect(result.reportRecipients).toEqual(['gestor@empresa.com']);
  });
});

describe('AiSettingsService.isFeatureEnabled', () => {
  it('devolve false para feature desligada', async () => {
    jest.clearAllMocks();
    prisma.tenant.findUnique.mockResolvedValue({
      settings: { ai: { features: { scoring: false } } },
    });

    await expect(new AiSettingsService().isFeatureEnabled(TENANT_ID, 'scoring')).resolves.toBe(
      false,
    );
  });

  it('devolve true por padrão', async () => {
    jest.clearAllMocks();
    prisma.tenant.findUnique.mockResolvedValue({ settings: {} });

    await expect(new AiSettingsService().isFeatureEnabled(TENANT_ID, 'chat')).resolves.toBe(true);
  });
});

describe('AiSettingsService.getUsageOverview', () => {
  it('agrega custo por mês no histórico', async () => {
    jest.clearAllMocks();
    prisma.aIUsageLog.groupBy.mockResolvedValue([
      {
        feature: AIFeature.CHAT,
        _count: { _all: 3 },
        _sum: { inputTokens: 100, outputTokens: 50, costUsdMicros: 1500 },
      },
    ]);
    prisma.aIUsageLog.findMany.mockResolvedValue([
      {
        createdAt: new Date('2026-07-05T00:00:00Z'),
        costUsdMicros: 1000,
        inputTokens: 10,
        outputTokens: 5,
      },
      {
        createdAt: new Date('2026-07-20T00:00:00Z'),
        costUsdMicros: 500,
        inputTokens: 4,
        outputTokens: 1,
      },
      {
        createdAt: new Date('2026-08-01T00:00:00Z'),
        costUsdMicros: 250,
        inputTokens: 2,
        outputTokens: 1,
      },
    ]);

    const overview = await new AiSettingsService().getUsageOverview(
      TENANT_ID,
      new Date('2026-08-03T00:00:00Z'),
    );

    expect(overview.currentMonth[0]).toMatchObject({ feature: AIFeature.CHAT, calls: 3 });
    expect(overview.history).toEqual([
      { period: '2026-07', costUsdMicros: 1500, tokens: 20 },
      { period: '2026-08', costUsdMicros: 250, tokens: 3 },
    ]);
  });
});

describe('AiSettingsService.listUsageLogs', () => {
  it('escopa por tenant e aplica filtro de feature', async () => {
    jest.clearAllMocks();
    prisma.aIUsageLog.count.mockResolvedValue(1);
    prisma.aIUsageLog.findMany.mockResolvedValue([]);

    await new AiSettingsService().listUsageLogs(TENANT_ID, {
      feature: AIFeature.OCR_FUEL,
      page: 1,
      limit: 10,
    });

    expect(prisma.aIUsageLog.findMany.mock.calls[0]?.[0]?.where).toMatchObject({
      tenantId: TENANT_ID,
      feature: AIFeature.OCR_FUEL,
    });
  });
});
