import { PlanType, prisma } from '@frota-leve/database';
import { AIPlanRequiredError, AIQuotaExceededError, AiError } from './errors';
import {
  checkAndReserveQuota,
  commitQuota,
  getTenantQuotaSnapshot,
  refundQuota,
} from './quota';

jest.mock('@frota-leve/database', () => {
  const actual = jest.requireActual('@frota-leve/database');

  return {
    ...actual,
    prisma: { $transaction: jest.fn() },
  };
});

const prismaMock = prisma as unknown as { $transaction: jest.Mock };

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-08-03T12:00:00.000Z');

function quotaRow(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT_ID,
    periodStart: new Date('2026-08-01T00:00:00.000Z'),
    periodEnd: new Date('2026-09-01T00:00:00.000Z'),
    tokenBudget: 2_000_000,
    tokensUsed: 0,
    costUsdMicros: 0,
    blockedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/**
 * `tx` simulado. `queryRaw` recebe as respostas na ordem em que o código as
 * consome, o que permite exercitar o caminho de reserva sem banco real.
 */
function buildTx(options: {
  plan?: PlanType | null;
  queryRawResults?: unknown[][];
}) {
  const queue = [...(options.queryRawResults ?? [])];

  const tx = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue(
        options.plan === null ? null : { id: TENANT_ID, plan: options.plan ?? PlanType.PROFESSIONAL },
      ),
    },
    $queryRaw: jest.fn().mockImplementation(() => Promise.resolve(queue.shift() ?? [])),
    $executeRaw: jest.fn().mockResolvedValue(1),
  };

  prismaMock.$transaction.mockImplementation((callback: (client: unknown) => unknown) =>
    Promise.resolve(callback(tx)),
  );

  return tx;
}

describe('getTenantQuotaSnapshot', () => {
  beforeEach(() => jest.clearAllMocks());

  it('devolve a quota do período corrente', async () => {
    buildTx({ queryRawResults: [[quotaRow()]] });

    await expect(getTenantQuotaSnapshot(TENANT_ID, NOW)).resolves.toMatchObject({
      tenantId: TENANT_ID,
      tokenBudget: 2_000_000,
    });
  });

  it('recusa tenant cujo plano não tem IA', async () => {
    buildTx({ plan: PlanType.ESSENTIAL });

    await expect(getTenantQuotaSnapshot(TENANT_ID, NOW)).rejects.toBeInstanceOf(
      AIPlanRequiredError,
    );
  });

  it('recusa tenant inexistente', async () => {
    buildTx({ plan: null });

    await expect(getTenantQuotaSnapshot(TENANT_ID, NOW)).rejects.toBeInstanceOf(AiError);
  });

  it('cria o registro quando o tenant ainda não tem quota', async () => {
    // Primeira busca vazia, depois o INSERT retorna a linha criada.
    const tx = buildTx({ queryRawResults: [[], [quotaRow()]] });

    await expect(getTenantQuotaSnapshot(TENANT_ID, NOW)).resolves.toBeTruthy();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('reseta a quota quando o período virou', async () => {
    const tx = buildTx({
      queryRawResults: [
        [quotaRow({ periodStart: new Date('2026-07-01T00:00:00.000Z') })],
        [quotaRow()],
      ],
    });

    await getTenantQuotaSnapshot(TENANT_ID, NOW);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
  });
});

describe('checkAndReserveQuota', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reserva quando há orçamento disponível', async () => {
    buildTx({ queryRawResults: [[quotaRow()], [quotaRow({ tokensUsed: 1000 })]] });

    await expect(checkAndReserveQuota(TENANT_ID, 1000)).resolves.toBeUndefined();
  });

  it('não faz UPDATE quando não há tokens a reservar', async () => {
    const tx = buildTx({ queryRawResults: [[quotaRow()]] });

    await checkAndReserveQuota(TENANT_ID, 0);

    // Só a leitura inicial; nenhum UPDATE de reserva.
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('bloqueia quando a quota já está marcada como bloqueada', async () => {
    const tx = buildTx({ queryRawResults: [[quotaRow({ blockedAt: NOW })]] });

    await expect(checkAndReserveQuota(TENANT_ID, 100)).rejects.toBeInstanceOf(
      AIQuotaExceededError,
    );
    expect(tx.$executeRaw).toHaveBeenCalled();
  });

  it('bloqueia quando o orçamento é zero', async () => {
    buildTx({ queryRawResults: [[quotaRow({ tokenBudget: 0 })]] });

    await expect(checkAndReserveQuota(TENANT_ID, 100)).rejects.toBeInstanceOf(
      AIQuotaExceededError,
    );
  });

  it('bloqueia quando o UPDATE condicional não afeta nenhuma linha', async () => {
    // Segunda resposta vazia = orçamento estourou na condição do SQL.
    const tx = buildTx({ queryRawResults: [[quotaRow()], []] });

    await expect(checkAndReserveQuota(TENANT_ID, 5_000_000)).rejects.toBeInstanceOf(
      AIQuotaExceededError,
    );
    expect(tx.$executeRaw).toHaveBeenCalled();
  });
});

describe('commitQuota', () => {
  beforeEach(() => jest.clearAllMocks());

  it('aplica o delta entre reservado e consumido', async () => {
    const tx = buildTx({ queryRawResults: [[quotaRow()]] });

    await commitQuota(TENANT_ID, 800, 1200, 1000);

    expect(tx.$executeRaw).toHaveBeenCalled();
  });

  it('não quebra com custo negativo', async () => {
    const tx = buildTx({ queryRawResults: [[quotaRow()]] });

    await expect(commitQuota(TENANT_ID, 100, -50, 0)).resolves.toBeUndefined();
    expect(tx.$executeRaw).toHaveBeenCalled();
  });
});

describe('refundQuota', () => {
  beforeEach(() => jest.clearAllMocks());

  it('devolve os tokens reservados', async () => {
    const tx = buildTx({ queryRawResults: [[quotaRow({ tokensUsed: 1000 })]] });

    await refundQuota(TENANT_ID, 1000);

    expect(tx.$executeRaw).toHaveBeenCalled();
  });

  it('não abre transação quando não há o que devolver', async () => {
    jest.clearAllMocks();

    await refundQuota(TENANT_ID, 0);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
