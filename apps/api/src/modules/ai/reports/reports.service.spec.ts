import { AIReportKind, AIReportStatus } from '@frota-leve/database';
import { reportService as aiReportService } from '@frota-leve/ai';
import { prisma as prismaClient } from '../../../config/database';
import { runWithConcurrency } from './ai-report-monthly.scheduler';
import { renderReportPdf } from './report-pdf';
import { ReportsService } from './reports.service';

type MockPrisma = {
  aIReport: { count: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock };
  user: { findMany: jest.Mock };
};

jest.mock('../../../config/database', () => ({
  prisma: {
    aIReport: { count: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    user: { findMany: jest.fn() },
  },
}));

jest.mock('@frota-leve/ai', () => ({
  reportService: { generateMonthly: jest.fn() },
}));

const prisma = prismaClient as unknown as MockPrisma;
const generateMonthly = aiReportService.generateMonthly as unknown as jest.Mock;

const CTX = { tenantId: 'tenant-1', userId: 'user-1' };
const NOW = new Date('2026-08-03T12:00:00.000Z');

describe('ReportsService.generateOnDemand', () => {
  let service: ReportsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportsService();
    generateMonthly.mockResolvedValue({ id: 'rel-1' });
  });

  it('gera relatório de um período válido', async () => {
    await service.generateOnDemand(CTX, '2026-06', NOW);

    expect(generateMonthly).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: CTX.tenantId,
        period: '2026-06',
        kind: AIReportKind.ON_DEMAND,
      }),
    );
  });

  it('recusa período futuro', async () => {
    await expect(service.generateOnDemand(CTX, '2026-12', NOW)).rejects.toThrow(/período futuro/i);
    expect(generateMonthly).not.toHaveBeenCalled();
  });

  it('recusa período com mais de 12 meses', async () => {
    await expect(service.generateOnDemand(CTX, '2025-01', NOW)).rejects.toThrow(/muito antigo/i);
  });

  it('recusa mês corrente com menos de 7 dias de dados', async () => {
    const earlyInMonth = new Date('2026-08-04T12:00:00.000Z');

    await expect(service.generateOnDemand(CTX, '2026-08', earlyInMonth)).rejects.toThrow(/7 dias/i);
  });

  it('aceita o mês corrente depois de 7 dias', async () => {
    const lateInMonth = new Date('2026-08-20T12:00:00.000Z');

    await expect(service.generateOnDemand(CTX, '2026-08', lateInMonth)).resolves.toBeDefined();
  });
});

describe('ReportsService.list', () => {
  it('escopa por tenant e pagina', async () => {
    jest.clearAllMocks();
    prisma.aIReport.count.mockResolvedValue(3);
    prisma.aIReport.findMany.mockResolvedValue([]);

    const result = await new ReportsService().list(CTX, { page: 2, limit: 2 });

    expect(prisma.aIReport.findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { tenantId: CTX.tenantId },
      skip: 2,
      take: 2,
    });
    expect(result.meta).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });
});

describe('ReportsService.hasGeneratedReport', () => {
  it('considera apenas relatórios MONTHLY já gerados', async () => {
    jest.clearAllMocks();
    prisma.aIReport.findFirst.mockResolvedValue({ id: 'rel-1' });

    await expect(new ReportsService().hasGeneratedReport('tenant-1', '2026-07')).resolves.toBe(
      true,
    );
    expect(prisma.aIReport.findFirst.mock.calls[0]?.[0]?.where).toMatchObject({
      tenantId: 'tenant-1',
      period: '2026-07',
      kind: AIReportKind.MONTHLY,
      status: AIReportStatus.GENERATED,
    });
  });
});

describe('runWithConcurrency', () => {
  it('respeita o limite de execuções simultâneas', async () => {
    const items = Array.from({ length: 9 }, (_, index) => index);
    let active = 0;
    let peak = 0;

    await runWithConcurrency(items, 3, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    });

    expect(peak).toBeLessThanOrEqual(3);
  });

  it('processa todos os itens', async () => {
    const processed: number[] = [];

    await runWithConcurrency([1, 2, 3, 4, 5], 2, async (item) => {
      processed.push(item);
    });

    expect(processed.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('não quebra com lista vazia', async () => {
    await expect(runWithConcurrency([], 3, async () => undefined)).resolves.toBeUndefined();
  });
});

describe('renderReportPdf', () => {
  it('gera um PDF válido a partir do markdown', async () => {
    const buffer = await renderReportPdf({
      title: 'Relatório de Frota',
      period: '2026-07',
      summary: 'Resumo do período.',
      markdown: '## Resumo Executivo\nTexto do relatório.\n\n- item de lista\n- **outro** item',
    });

    expect(buffer.length).toBeGreaterThan(500);
    // Assinatura de arquivo PDF.
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
