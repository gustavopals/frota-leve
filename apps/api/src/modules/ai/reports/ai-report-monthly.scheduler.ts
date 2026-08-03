import { AIReportKind } from '@frota-leve/database';
import { reportService as aiReportService } from '@frota-leve/ai';
import { prisma } from '../../../config/database';
import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import { anomalyScanService } from '../anomaly/anomaly-scan.service';
import { reportEmailService } from './report-email.service';
import { reportsService } from './reports.service';

const HOUR_INTERVAL_MS = 60 * 60 * 1000;

/** Dia e hora (UTC) em que o relatório do mês anterior é gerado (TASK 3.5.3). */
const RUN_DAY_OF_MONTH = 2;
const RUN_HOUR_UTC = 6;

/**
 * Concorrência máxima de tenants processados em paralelo.
 * O ROADMAP pede 3 para não estourar o rate limit da Anthropic.
 */
const MAX_CONCURRENCY = 3;

function previousPeriodOf(reference: Date): string {
  const previous = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - 1, 1));

  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Executa `worker` sobre `items` com no máximo `limit` execuções simultâneas. */
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];

  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      await worker(next);
    }
  });

  await Promise.all(runners);
}

/**
 * Relatório mensal automático (TASK 3.5.3).
 *
 * Mantém o padrão de scheduler do projeto em vez do BullMQ citado no ROADMAP.
 * Como `setInterval` não entende cron, o job acorda de hora em hora e só
 * trabalha na janela combinada (dia 2, 06h UTC); a idempotência do
 * `generateMonthly` garante que acordar várias vezes não gere duplicata.
 */
export class AiReportMonthlyScheduler {
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  start(): void {
    if (env.NODE_ENV === 'test' || this.interval) {
      return;
    }

    logger.info('Scheduler de relatório mensal de IA iniciado.');

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

  /** `force` ignora a janela de execução — usado em teste e em disparo manual. */
  async run(referenceDate: Date = new Date(), force = false): Promise<number> {
    if (this.running) {
      logger.warn(
        'Execução do scheduler de relatórios ignorada porque outra já está em andamento.',
      );
      return 0;
    }

    if (!force && !this.isWithinWindow(referenceDate)) {
      return 0;
    }

    this.running = true;

    try {
      const period = previousPeriodOf(referenceDate);
      const tenantIds = await anomalyScanService.listScannableTenantIds();
      let generated = 0;

      await runWithConcurrency(tenantIds, MAX_CONCURRENCY, async (tenantId) => {
        try {
          if (await reportsService.hasGeneratedReport(tenantId, period)) {
            return;
          }

          const report = await aiReportService.generateMonthly({
            tenantId,
            period,
            kind: AIReportKind.MONTHLY,
          });
          generated += 1;

          await this.notify(tenantId, report.id, period, report.summary);
        } catch (error) {
          logger.error('Falha ao gerar relatório mensal do tenant.', {
            tenantId,
            period,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      if (generated > 0) {
        logger.info('Relatórios mensais gerados.', { period, generated });
      }

      return generated;
    } finally {
      this.running = false;
    }
  }

  private isWithinWindow(reference: Date): boolean {
    return reference.getUTCDate() === RUN_DAY_OF_MONTH && reference.getUTCHours() === RUN_HOUR_UTC;
  }

  /** Envia o resumo para OWNER/ADMIN (TASK 3.5.5). Falha não derruba o job. */
  private async notify(
    tenantId: string,
    reportId: string,
    period: string,
    summary: string,
  ): Promise<void> {
    try {
      const recipients = await prisma.user.findMany({
        where: { tenantId, isActive: true, role: { in: ['OWNER', 'ADMIN'] } },
        select: { id: true, name: true, email: true },
      });

      for (const recipient of recipients) {
        await reportEmailService.sendMonthlyReport({
          recipient,
          period,
          summary,
          reportUrl: `${env.FRONTEND_URL}/ai/reports/${reportId}`,
        });
      }
    } catch (error) {
      logger.error('Falha ao enviar e-mail do relatório mensal.', {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async runSafely(referenceDate: Date = new Date()): Promise<void> {
    try {
      await this.run(referenceDate);
    } catch (error) {
      logger.error('Falha ao executar scheduler de relatórios.', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const aiReportMonthlyScheduler = new AiReportMonthlyScheduler();
