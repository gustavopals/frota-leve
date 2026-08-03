import { PlanType, prisma } from '@frota-leve/database';
import { AiClient } from './client';
import { AI_MODEL_SONNET } from './models';
import type { AiClientInvokeParams } from './types';

/**
 * Verificação de prompt caching (DoD da Fase 3).
 *
 * O critério do ROADMAP é `cacheReadTokens > 0`, que só se observa chamando a
 * Anthropic de verdade. O que dá para provar sem credencial — e é o que está
 * sob nosso controle — são as duas metades do mecanismo:
 *
 * 1. o payload enviado marca `cache_control: ephemeral` no system e no
 *    contexto cacheável (senão a Anthropic nunca cria a entrada de cache);
 * 2. a resposta com `cache_read_input_tokens` é mapeada para `cacheReadTokens`
 *    (senão a leitura acontece mas nunca aparece no AIUsageLog).
 *
 * Juntas, elas garantem que só falta o ambiente real para o item fechar.
 */

const capturedRequests: Array<Record<string, unknown>> = [];
let mockUsage: Record<string, number> = {
  input_tokens: 100,
  output_tokens: 20,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
};

jest.mock('@anthropic-ai/sdk', () => {
  class FakeAnthropic {
    messages = {
      create: (params: Record<string, unknown>) => {
        capturedRequests.push(params);

        return Promise.resolve({
          id: 'msg_fake',
          content: [{ type: 'text', text: 'resposta' }],
          stop_reason: 'end_turn',
          usage: mockUsage,
        });
      },
    };
  }

  class FakeApiError extends Error {}

  return {
    __esModule: true,
    default: FakeAnthropic,
    APIError: FakeApiError,
    APIConnectionError: class extends FakeApiError {},
    APIConnectionTimeoutError: class extends FakeApiError {},
    RateLimitError: class extends FakeApiError {},
  };
});

jest.mock('@frota-leve/database', () => {
  const actual = jest.requireActual('@frota-leve/database');

  return {
    ...actual,
    prisma: { tenant: { findUnique: jest.fn() }, aIUsageLog: { create: jest.fn() } },
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

function params(overrides: Partial<AiClientInvokeParams> = {}): AiClientInvokeParams {
  return {
    tenantId: 'tenant-1',
    feature: 'chat',
    model: AI_MODEL_SONNET,
    system: 'Prompt de sistema estável entre chamadas.',
    messages: [
      { role: 'system', content: '{"contextKind":"fleetCatalog"}', cacheable: true },
      { role: 'user', content: `pergunta ${Math.random()}` },
    ],
    maxTokens: 500,
    ...overrides,
  };
}

describe('prompt caching', () => {
  const originalMock = process.env.AI_MOCK;
  const originalKey = process.env.ANTHROPIC_API_KEY;
  let client: AiClient;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedRequests.length = 0;
    // Desliga o mock interno para exercitar o caminho real de montagem do payload.
    process.env.AI_MOCK = 'false';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-fake-para-teste';
    client = new AiClient();
    prismaMock.tenant.findUnique.mockResolvedValue({ plan: PlanType.ENTERPRISE });
    prismaMock.aIUsageLog.create.mockResolvedValue({});
    mockUsage = {
      input_tokens: 100,
      output_tokens: 20,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    };
  });

  afterAll(() => {
    process.env.AI_MOCK = originalMock;
    process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it('marca cache_control no bloco de system', async () => {
    await client.invoke(params());

    const system = capturedRequests[0]?.['system'] as Array<Record<string, unknown>>;
    expect(system[0]).toMatchObject({ cache_control: { type: 'ephemeral' } });
  });

  it('marca cache_control no contexto de frota cacheável', async () => {
    await client.invoke(params());

    const system = capturedRequests[0]?.['system'] as Array<Record<string, unknown>>;
    const context = system.find((block) => String(block['text']).includes('fleetCatalog'));

    expect(context).toMatchObject({ cache_control: { type: 'ephemeral' } });
  });

  it('não marca cache_control em contexto declarado como não cacheável', async () => {
    await client.invoke(
      params({
        messages: [
          { role: 'system', content: '{"volatil":true}', cacheable: false },
          { role: 'user', content: 'pergunta volátil' },
        ],
      }),
    );

    const system = capturedRequests[0]?.['system'] as Array<Record<string, unknown>>;
    const context = system.find((block) => String(block['text']).includes('volatil'));

    expect(context?.['cache_control']).toBeUndefined();
  });

  it('mantém o prefixo estável entre chamadas — condição para o cache valer', async () => {
    await client.invoke(params({ messages: [{ role: 'user', content: 'primeira' }] }));
    await client.invoke(params({ messages: [{ role: 'user', content: 'segunda' }] }));

    expect(JSON.stringify(capturedRequests[0]?.['system'])).toBe(
      JSON.stringify(capturedRequests[1]?.['system']),
    );
  });

  it('propaga cache_read_input_tokens da resposta para cacheReadTokens', async () => {
    mockUsage = {
      input_tokens: 10,
      output_tokens: 20,
      cache_read_input_tokens: 4096,
      cache_creation_input_tokens: 0,
    };

    const result = await client.invoke(params());

    expect(result.usage?.cacheReadTokens).toBe(4096);
  });

  it('registra os tokens de cache no AIUsageLog', async () => {
    mockUsage = {
      input_tokens: 10,
      output_tokens: 20,
      cache_read_input_tokens: 2048,
      cache_creation_input_tokens: 512,
    };

    await client.invoke(params());

    expect(prismaMock.aIUsageLog.create.mock.calls[0]?.[0]?.data).toMatchObject({
      cacheReadTokens: 2048,
      cacheCreationTokens: 512,
    });
  });
});
