import { AIReportKind, AIReportStatus, type Prisma } from '@frota-leve/database';
import { reportService as aiReportService } from '@frota-leve/ai';
import { prisma } from '../../../config/database';
import { NotFoundError, ValidationError } from '../../../shared/errors';
import { renderReportPdf } from './report-pdf';
import { MAX_MONTHS_BACK, type ListReportsQueryInput } from './reports.validators';

/** Mínimo de dias com dados no período para valer um relatório (TASK 3.5.6). */
const MIN_DAYS_OF_DATA = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReportActorContext {
  tenantId: string;
  userId: string;
}

function periodToDate(period: string): Date {
  const [year, month] = period.split('-').map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, 1));
}

function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth())
  );
}

export class ReportsService {
  async list(ctx: ReportActorContext, query: ListReportsQueryInput) {
    const where: Prisma.AIReportWhereInput = {
      tenantId: ctx.tenantId,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [total, data] = await Promise.all([
      prisma.aIReport.count({ where }),
      prisma.aIReport.findMany({
        where,
        orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          period: true,
          kind: true,
          summary: true,
          status: true,
          generatedAt: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(Math.ceil(total / query.limit), 1),
      },
    };
  }

  async getById(ctx: ReportActorContext, id: string) {
    const report = await prisma.aIReport.findFirst({ where: { id, tenantId: ctx.tenantId } });

    if (!report) {
      throw new NotFoundError('Relatório não encontrado');
    }

    return report;
  }

  async getPdf(ctx: ReportActorContext, id: string): Promise<{ filename: string; buffer: Buffer }> {
    const report = await this.getById(ctx, id);

    const buffer = await renderReportPdf({
      title: 'Relatório de Frota',
      period: report.period,
      summary: report.summary,
      markdown: report.content,
    });

    return { filename: `relatorio-frota-${report.period}.pdf`, buffer };
  }

  /**
   * Geração sob demanda (TASK 3.5.6).
   *
   * Recusa períodos futuros, mais de 12 meses atrás, ou com menos de 7 dias de
   * dados — relatórios sobre janelas rasas produzem narrativa sem sustentação.
   */
  async generateOnDemand(ctx: ReportActorContext, period: string, now: Date = new Date()) {
    const periodStart = periodToDate(period);
    const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const distance = monthsBetween(periodStart, currentMonth);

    if (distance < 0) {
      throw new ValidationError('Não é possível gerar relatório de um período futuro');
    }

    if (distance > MAX_MONTHS_BACK) {
      throw new ValidationError(
        `Período muito antigo. Escolha um mês nos últimos ${MAX_MONTHS_BACK} meses`,
      );
    }

    const periodEnd = new Date(
      Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 1),
    );
    const effectiveEnd = periodEnd.getTime() > now.getTime() ? now : periodEnd;
    const daysOfData = Math.floor((effectiveEnd.getTime() - periodStart.getTime()) / DAY_MS);

    if (daysOfData < MIN_DAYS_OF_DATA) {
      throw new ValidationError(
        `O período precisa de pelo menos ${MIN_DAYS_OF_DATA} dias de dados`,
      );
    }

    return aiReportService.generateMonthly({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      period,
      kind: AIReportKind.ON_DEMAND,
    });
  }

  /** Tenants com relatório mensal pendente para o período. */
  async hasGeneratedReport(tenantId: string, period: string): Promise<boolean> {
    const existing = await prisma.aIReport.findFirst({
      where: {
        tenantId,
        period,
        kind: AIReportKind.MONTHLY,
        status: AIReportStatus.GENERATED,
      },
      select: { id: true },
    });

    return existing !== null;
  }
}

export const reportsService = new ReportsService();
