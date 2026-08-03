import { AIUsageStatus, PlanType, prisma } from '@frota-leve/database';
import { AiClient } from './client';
import { AIPlanRequiredError, AIQuotaExceededError } from './errors';
import { AI_MODEL_HAIKU, AI_MODEL_SONNET } from './models';
import { checkAndReserveQuota, commitQuota, refundQuota } from './quota';
import type { AiClientInvokeParams } from './types';

jest.mock('@frota-leve/database', () => {
  const actual = jest.requireActual('@frota-leve/database');

  return {
    ...actual,
    prisma: {
      tenant: { findUnique: jest.fn() },
      aIUsageLog: { create: jest.fn() },
    },
  };
});

jest.mock('./quota', () => ({
  checkAndReserveQuota: jest.fn(),
  commitQuota: jest.fn(),
  refundQuota: jest.fn(),
}));

const prismaMock = prisma as unknown as {
  tenant: { findUnique: jest.Mock };
  aIUsageLog: { create: jest.Mock };
};
const reserveMock = checkAndReserveQuota as unknown as jest.Mock;
const commitMock = commitQuota as unknown as jest.Mock;
const refundMock = refundQuota as unknown as jest.Mock;

const TENANT_ID = 'tenant-1';

function params(overrides: Partial<AiClientInvokeParams> = {}): AiClientInvokeParams {
  return {
    tenantId: TENANT_ID,
    feature: 'chat',
    model: AI_MODEL_SONNET,
    system: 'system prompt',
    messages: [{ role: 'user', content: `pergunta ${Math.random()}` }],
    maxTokens: 500,
    ...overrides,
  };
}

/**
 * O AiClient roda em modo mock (AI_MOCK=true), que substitui o provider real.
 * Assim os testes exercitam plano, quota, cache e log sem tocar a Anthropic —
 * é também o que garante "zero chamadas reais em CI" (DoD da Fase 3).
 */
describe('AiClient.invoke', () => {
  const originalMock = process.env.AI_MOCK;
  let client: AiClient;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AI_MOCK = 'true';
    client = new AiClient();
    prismaMock.tenant.findUnique.mockResolvedValue({ plan: PlanType.ENTERPRISE });
    prismaMock.aIUsageLog.create.mockResolvedValue({});
    reserveMock.mockResolvedValue(undefined);
    commitMock.mockResolvedValue(undefined);
    refundMock.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env.AI_MOCK = originalMock;
  });

  it('executa e registra sucesso no AIUsageLog', async () => {
    const result = await client.invoke(params());

    expect(result).toBeDefined();
    expect(prismaMock.aIUsageLog.create).toHaveBeenCalled();
    expect(prismaMock.aIUsageLog.create.mock.calls[0]?.[0]?.data).toMatchObject({
      tenantId: TENANT_ID,
      status: AIUsageStatus.SUCCESS,
    });
  });

  it('reserva quota antes e faz commit depois', async () => {
    await client.invoke(params());

    expect(reserveMock).toHaveBeenCalledWith(TENANT_ID, expect.any(Number));
    expect(commitMock).toHaveBeenCalled();
  });

  it('bloqueia tenant cujo plano não tem IA e registra BLOCKED', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ plan: PlanType.ESSENTIAL });

    await expect(client.invoke(params())).rejects.toBeInstanceOf(AIPlanRequiredError);

    expect(prismaMock.aIUsageLog.create.mock.calls[0]?.[0]?.data).toMatchObject({
      status: AIUsageStatus.BLOCKED,
    });
    expect(reserveMock).not.toHaveBeenCalled();
  });

  it('bloqueia modelo fora da lista permitida do plano', async () => {
    // O plano PROFESSIONAL não inclui Opus.
    prismaMock.tenant.findUnique.mockResolvedValue({ plan: PlanType.PROFESSIONAL });

    await expect(client.invoke(params({ model: 'claude-opus-5' }))).rejects.toThrow();
    expect(reserveMock).not.toHaveBeenCalled();
  });

  it('registra BLOCKED quando a quota estoura', async () => {
    reserveMock.mockRejectedValue(new AIQuotaExceededError(TENANT_ID));

    await expect(client.invoke(params())).rejects.toBeInstanceOf(AIQuotaExceededError);

    expect(prismaMock.aIUsageLog.create.mock.calls[0]?.[0]?.data).toMatchObject({
      status: AIUsageStatus.BLOCKED,
    });
  });

  it('serve do cache na segunda chamada idêntica, sem novo provider', async () => {
    const shared = params({ messages: [{ role: 'user', content: 'pergunta estável' }] });

    await client.invoke(shared);
    const second = await client.invoke(shared);

    expect(second.cacheHit).toBe(true);
    // Cache hit também é registrado para auditoria de consumo.
    expect(prismaMock.aIUsageLog.create).toHaveBeenCalledTimes(2);
  });

  it('não usa cache quando o prompt tem imagem nova', async () => {
    const withImage = params({
      feature: 'ocr',
      model: AI_MODEL_HAIKU,
      messages: [{ role: 'user', content: 'leia o cupom', containsFreshImage: true }],
    });

    await client.invoke(withImage);
    const second = await client.invoke(withImage);

    expect(second.cacheHit).toBeFalsy();
  });

  it('redige PII de qualquer prompt, não só do chat', async () => {
    // A redação vive no client, então vale para report, OCR e scoring também.
    const withPii = params({
      feature: 'report',
      system: 'Contato do gestor: gestor@empresa.com',
      messages: [
        { role: 'user', content: 'CPF 123.456.789-01, telefone (11) 98765-4321' },
      ],
    });

    const result = await client.invoke(withPii);

    expect(result).toBeDefined();
    // O mock ecoa o prompt recebido; nada de PII pode ter passado.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('gestor@empresa.com');
    expect(serialized).not.toContain('123.456.789-01');
  });

  it('lança quando o tenant não existe', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue(null);

    await expect(client.invoke(params())).rejects.toThrow();
  });
});
