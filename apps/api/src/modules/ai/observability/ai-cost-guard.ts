import { prisma } from '../../../config/database';
import { env } from '../../../config/env';
import { logger } from '../../../config/logger';

const MICROS_PER_USD = 1_000_000;

/**
 * Circuit breaker de custo (TASK 3.9.2).
 *
 * Quando o gasto global do dia ultrapassa `AI_DAILY_COST_USD_LIMIT`, liga
 * `AI_DEGRADED`, que força o uso do Haiku em tudo até o próximo reset diário.
 * O estado vive em `process.env` porque é por instância e precisa ser lido de
 * dentro do pacote de IA, que não conhece o `env` da API.
 */
export const AI_DEGRADED_ENV = 'AI_DEGRADED';

export function isAiDegraded(): boolean {
  return process.env[AI_DEGRADED_ENV] === 'true';
}

export function setAiDegraded(degraded: boolean): void {
  process.env[AI_DEGRADED_ENV] = degraded ? 'true' : 'false';
}

/** Gasto global (todos os tenants) do dia corrente, em dólares. */
export async function getTodayCostUsd(reference = new Date()): Promise<number> {
  const dayStart = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()),
  );

  const result = await prisma.aIUsageLog.aggregate({
    where: { createdAt: { gte: dayStart } },
    _sum: { costUsdMicros: true },
  });

  return (result._sum.costUsdMicros ?? 0) / MICROS_PER_USD;
}

/**
 * Avalia o limite e ajusta a flag. Devolve o estado resultante.
 *
 * Também desliga a degradação quando o dia virou e o gasto voltou abaixo do
 * limite — sem isso a flag ficaria presa até o próximo deploy.
 */
export async function evaluateDailyCostLimit(reference = new Date()): Promise<{
  costUsd: number;
  limitUsd: number;
  degraded: boolean;
}> {
  const costUsd = await getTodayCostUsd(reference);
  const limitUsd = env.AI_DAILY_COST_USD_LIMIT;
  const degraded = costUsd > limitUsd;

  if (degraded && !isAiDegraded()) {
    logger.error('Limite diário de custo de IA excedido. Ativando modo degradado.', {
      costUsd,
      limitUsd,
    });
  }

  if (!degraded && isAiDegraded()) {
    logger.info('Custo diário de IA voltou ao normal. Desativando modo degradado.', {
      costUsd,
      limitUsd,
    });
  }

  setAiDegraded(degraded);

  return { costUsd, limitUsd, degraded };
}
