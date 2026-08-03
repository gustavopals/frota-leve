import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import { anomalyScanService } from './anomaly-scan.service';

const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Varredura diária de anomalias (TASK 3.4.2).
 *
 * Segue o mesmo padrão dos demais schedulers do projeto em vez do BullMQ citado
 * no ROADMAP: o repositório não tem fila, e um `setInterval` mantém o job no
 * mesmo processo da API, sem exigir worker separado nem mudança de deploy.
 *
 * A detecção em si é determinística e não consome IA — apenas a explicação
 * textual (TASK 3.4.3) dependerá da Anthropic.
 */
export class AiAnomalyScanScheduler {
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  start(): void {
    if (env.NODE_ENV === 'test' || this.interval) {
      return;
    }

    logger.info('Scheduler de anomalias de IA iniciado.');
    void this.runSafely();

    this.interval = setInterval(() => {
      void this.runSafely();
    }, DAILY_INTERVAL_MS);

    this.interval.unref();
  }

  stop(): void {
    if (!this.interval) {
      return;
    }

    clearInterval(this.interval);
    this.interval = null;
  }

  async run(referenceDate: Date = new Date()): Promise<number> {
    if (this.running) {
      logger.warn('Execução do scheduler de anomalias ignorada porque outra já está em andamento.');
      return 0;
    }

    this.running = true;

    try {
      const results = await anomalyScanService.scanAllTenants(referenceDate);
      const created = results.reduce((total, result) => total + result.created, 0);
      const refreshed = results.reduce((total, result) => total + result.refreshed, 0);

      if (created > 0 || refreshed > 0) {
        logger.info('Varredura de anomalias concluída.', {
          tenantsScanned: results.length,
          anomaliesCreated: created,
          anomaliesRefreshed: refreshed,
        });
      }

      return created;
    } finally {
      this.running = false;
    }
  }

  private async runSafely(referenceDate: Date = new Date()): Promise<void> {
    try {
      await this.run(referenceDate);
    } catch (error) {
      logger.error('Falha ao executar scheduler de anomalias.', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const aiAnomalyScanScheduler = new AiAnomalyScanScheduler();
