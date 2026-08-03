import { AiAnomalyScanScheduler } from './anomaly/ai-anomaly-scan.scheduler';
import { anomalyScanService } from './anomaly/anomaly-scan.service';
import { AiCostGuardScheduler } from './observability/ai-cost-guard.scheduler';
import { evaluateDailyCostLimit } from './observability/ai-cost-guard';
import { AiReportMonthlyScheduler } from './reports/ai-report-monthly.scheduler';
import { AiDriverScoringScheduler } from './scoring/ai-driver-scoring.scheduler';
import { driverScoringService } from './scoring/driver-scoring.service';
import { reportsService } from './reports/reports.service';
import { reportEmailService } from './reports/report-email.service';
import { reportService as aiReportService } from '@frota-leve/ai';
import { prisma as prismaClient } from '../../config/database';

jest.mock('../../config/database', () => ({
  prisma: { user: { findMany: jest.fn() } },
}));

jest.mock('./anomaly/anomaly-scan.service', () => ({
  anomalyScanService: {
    listScannableTenantIds: jest.fn(),
    scanTenant: jest.fn(),
    scanAllTenants: jest.fn(),
  },
}));

jest.mock('./scoring/driver-scoring.service', () => ({
  driverScoringService: { scoreTenant: jest.fn() },
}));

jest.mock('./reports/reports.service', () => ({
  reportsService: { hasGeneratedReport: jest.fn() },
}));

jest.mock('./reports/report-email.service', () => ({
  reportEmailService: { sendMonthlyReport: jest.fn() },
}));

jest.mock('./observability/ai-cost-guard', () => ({
  evaluateDailyCostLimit: jest.fn(),
}));

jest.mock('@frota-leve/ai', () => ({
  reportService: { generateMonthly: jest.fn() },
}));

const listTenants = anomalyScanService.listScannableTenantIds as unknown as jest.Mock;
const scanAllTenants = anomalyScanService.scanAllTenants as unknown as jest.Mock;
const scoreTenant = driverScoringService.scoreTenant as unknown as jest.Mock;
const hasReport = reportsService.hasGeneratedReport as unknown as jest.Mock;
const generateMonthly = aiReportService.generateMonthly as unknown as jest.Mock;
const sendEmail = reportEmailService.sendMonthlyReport as unknown as jest.Mock;
const evaluateCost = evaluateDailyCostLimit as unknown as jest.Mock;
const prisma = prismaClient as unknown as { user: { findMany: jest.Mock } };

describe('AiAnomalyScanScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listTenants.mockResolvedValue(['t1', 't2']);
    scanAllTenants.mockResolvedValue([
      { tenantId: 't1', detected: 1, created: 1, refreshed: 0 },
      { tenantId: 't2', detected: 2, created: 1, refreshed: 1 },
    ]);
  });

  it('soma as anomalias criadas em todos os tenants', async () => {
    const created = await new AiAnomalyScanScheduler().run(new Date());

    expect(scanAllTenants).toHaveBeenCalledTimes(1);
    expect(created).toBe(2);
  });

  it('não roda duas execuções em paralelo', async () => {
    const scheduler = new AiAnomalyScanScheduler();
    let release: (() => void) | undefined;
    scanAllTenants.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve([]);
        }),
    );

    const first = scheduler.run(new Date());
    const second = await scheduler.run(new Date());

    expect(second).toBe(0);
    release?.();
    await first;
  });

  it('start() é inerte em ambiente de teste', () => {
    const scheduler = new AiAnomalyScanScheduler();

    expect(() => {
      scheduler.start();
      scheduler.stop();
    }).not.toThrow();
  });
});

describe('AiReportMonthlyScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listTenants.mockResolvedValue(['t1']);
    hasReport.mockResolvedValue(false);
    generateMonthly.mockResolvedValue({ id: 'rel-1', summary: 'resumo' });
    prisma.user.findMany.mockResolvedValue([{ id: 'u1', name: 'Ana', email: 'a@e.com' }]);
    sendEmail.mockResolvedValue(undefined);
  });

  it('não faz nada fora da janela de execução', async () => {
    // Dia 5 às 10h não é a janela (dia 2, 06h UTC).
    const generated = await new AiReportMonthlyScheduler().run(
      new Date('2026-08-05T10:00:00.000Z'),
    );

    expect(generated).toBe(0);
    expect(generateMonthly).not.toHaveBeenCalled();
  });

  it('gera o relatório do mês anterior na janela', async () => {
    const generated = await new AiReportMonthlyScheduler().run(
      new Date('2026-08-02T06:00:00.000Z'),
    );

    expect(generated).toBe(1);
    expect(generateMonthly.mock.calls[0]?.[0]).toMatchObject({ period: '2026-07' });
  });

  it('pula tenant que já tem relatório do período', async () => {
    hasReport.mockResolvedValue(true);

    const generated = await new AiReportMonthlyScheduler().run(
      new Date('2026-08-02T06:00:00.000Z'),
    );

    expect(generated).toBe(0);
    expect(generateMonthly).not.toHaveBeenCalled();
  });

  it('envia o resumo por e-mail para OWNER/ADMIN', async () => {
    await new AiReportMonthlyScheduler().run(new Date('2026-08-02T06:00:00.000Z'), true);

    expect(sendEmail.mock.calls[0]?.[0]).toMatchObject({
      period: '2026-07',
      summary: 'resumo',
    });
  });

  it('não deixa falha de e-mail derrubar a geração', async () => {
    sendEmail.mockRejectedValue(new Error('resend fora'));

    await expect(
      new AiReportMonthlyScheduler().run(new Date('2026-08-02T06:00:00.000Z')),
    ).resolves.toBe(1);
  });

  it('segue para os demais tenants quando um falha', async () => {
    listTenants.mockResolvedValue(['t1', 't2']);
    generateMonthly
      .mockRejectedValueOnce(new Error('quota'))
      .mockResolvedValueOnce({ id: 'rel-2', summary: 'ok' });

    const generated = await new AiReportMonthlyScheduler().run(
      new Date('2026-08-02T06:00:00.000Z'),
    );

    expect(generated).toBe(1);
  });
});

describe('AiDriverScoringScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listTenants.mockResolvedValue(['t1']);
    scoreTenant.mockResolvedValue([{ driverId: 'd1', score: 90, recommended: false }]);
  });

  it('não roda fora da janela semanal', async () => {
    // Terça-feira não é segunda.
    const scored = await new AiDriverScoringScheduler().run(new Date('2026-08-04T04:00:00.000Z'));

    expect(scored).toBe(0);
    expect(scoreTenant).not.toHaveBeenCalled();
  });

  it('roda na segunda às 04h UTC', async () => {
    const scored = await new AiDriverScoringScheduler().run(new Date('2026-08-03T04:00:00.000Z'));

    expect(scored).toBe(1);
    expect(scoreTenant).toHaveBeenCalledWith('t1', expect.any(Date));
  });

  it('aceita execução forçada fora da janela', async () => {
    const scored = await new AiDriverScoringScheduler().run(
      new Date('2026-08-04T10:00:00.000Z'),
      true,
    );

    expect(scored).toBe(1);
  });
});

describe('AiCostGuardScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    evaluateCost.mockResolvedValue({ costUsd: 10, limitUsd: 50, degraded: false });
  });

  it('start() não explode em ambiente de teste', () => {
    const scheduler = new AiCostGuardScheduler();

    expect(() => {
      scheduler.start();
      scheduler.stop();
    }).not.toThrow();
  });

  it('stop() é idempotente', () => {
    const scheduler = new AiCostGuardScheduler();

    expect(() => {
      scheduler.stop();
      scheduler.stop();
    }).not.toThrow();
  });
});
