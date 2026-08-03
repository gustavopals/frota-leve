import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import { anomalyScanService } from '../anomaly/anomaly-scan.service';
import { driverScoringService } from './driver-scoring.service';

const HOUR_INTERVAL_MS = 60 * 60 * 1000;

/** Segunda-feira às 04h UTC (TASK 3.7.2). */
const RUN_WEEKDAY = 1;
const RUN_HOUR_UTC = 4;

/**
 * Scoring semanal de motoristas.
 *
 * Mesmo padrão dos demais schedulers do projeto: acorda de hora em hora e só
 * trabalha na janela combinada. O upsert por `driverId+periodStart` torna a
 * execução repetida inofensiva.
 */
export class AiDriverScoringScheduler {
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  start(): void {
    if (env.NODE_ENV === 'test' || this.interval) {
      return;
    }

    logger.info('Scheduler de scoring de motoristas iniciado.');

    this.interval = setInterval(() => {
      void this.runSafely();
    }, HOUR_INTERVAL_MS);

    this.interval.unref();
  }

  stop(): void {
    if (!this.interval) {
      return;
    }

    clearInterval(this.interval);
    this.interval = null;
  }

  async run(referenceDate: Date = new Date(), force = false): Promise<number> {
    if (this.running) {
      logger.warn('Execução do scheduler de scoring ignorada porque outra já está em andamento.');
      return 0;
    }

    if (!force && !this.isWithinWindow(referenceDate)) {
      return 0;
    }

    this.running = true;

    try {
      const tenantIds = await anomalyScanService.listScannableTenantIds();
      let scored = 0;

      for (const tenantId of tenantIds) {
        const results = await driverScoringService.scoreTenant(tenantId, referenceDate);
        scored += results.length;
      }

      if (scored > 0) {
        logger.info('Scoring de motoristas concluído.', { driversScored: scored });
      }

      return scored;
    } finally {
      this.running = false;
    }
  }

  private isWithinWindow(reference: Date): boolean {
    return reference.getUTCDay() === RUN_WEEKDAY && reference.getUTCHours() === RUN_HOUR_UTC;
  }

  private async runSafely(referenceDate: Date = new Date()): Promise<void> {
    try {
      await this.run(referenceDate);
    } catch (error) {
      logger.error('Falha ao executar scheduler de scoring.', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const aiDriverScoringScheduler = new AiDriverScoringScheduler();
