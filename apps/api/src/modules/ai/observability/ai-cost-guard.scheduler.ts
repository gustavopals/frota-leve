import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import { evaluateDailyCostLimit } from './ai-cost-guard';

/** Reavalia o limite a cada 15 minutos — granularidade suficiente para o corte. */
const INTERVAL_MS = 15 * 60 * 1000;

/** Vigia o custo diário e liga/desliga o modo degradado (TASK 3.9.2). */
export class AiCostGuardScheduler {
  private interval: NodeJS.Timeout | null = null;

  start(): void {
    if (env.NODE_ENV === 'test' || this.interval) {
      return;
    }

    logger.info('Guarda de custo de IA iniciada.');
    void this.runSafely();

    this.interval = setInterval(() => {
      void this.runSafely();
    }, INTERVAL_MS);

    this.interval.unref();
  }

  stop(): void {
    if (!this.interval) {
      return;
    }

    clearInterval(this.interval);
    this.interval = null;
  }

  private async runSafely(): Promise<void> {
    try {
      await evaluateDailyCostLimit();
    } catch (error) {
      logger.error('Falha ao avaliar o limite diário de custo de IA.', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const aiCostGuardScheduler = new AiCostGuardScheduler();
