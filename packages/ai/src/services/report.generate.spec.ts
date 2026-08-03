import { AIReportKind, AIReportStatus, prisma } from '@frota-leve/database';
import { aiClient } from '../client';
import { buildMonthlyAggregates } from '../context/monthly-aggregates';
import { REPORT_REQUIRED_HEADINGS } from '../prompts/system/report.v1';
import { ReportService } from './report.service';

jest.mock('@frota-leve/database', () => {
  const actual = jest.requireActual('@frota-leve/database');

  return {
    ...actual,
    prisma: {
      aIReport: { findFirst: jest.fn(), upsert: jest.fn(), update: jest.fn() },
    },
  };
});

jest.mock('../client', () => ({ aiClient: { invoke: jest.fn() } }));
jest.mock('../context/monthly-aggregates', () => ({ buildMonthlyAggregates: jest.fn() }));

const prismaMock = prisma as unknown as {
  aIReport: { findFirst: jest.Mock; upsert: jest.Mock; update: jest.Mock };
};
const invoke = aiClient.invoke as unknown as jest.Mock;
const buildAggregates = buildMonthlyAggregates as unknown as jest.Mock;

const AGGREGATES = {
  tenantId: 'tenant-1',
  period: '2026-07',
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-08-01T00:00:00.000Z',
  fleetSize: 5,
  totalCost: 10000,
  costByCategory: [{ category: 'LIGHT', total: 10000 }],
  topVehiclesByCostPerKm: [],
  fuel: {
    totalLiters: 500,
    totalCost: 6000,
    averageKmPerLiter: 9,
    kmPerLiterStdDev: 1,
    recordCount: 20,
  },
  maintenance: { completed: 2, pending: 1, totalCost: 3500 },
  fines: { count: 1, totalAmount: 500, totalPoints: 4 },
  highAnomalies: [],
  comparison: { previousPeriod: '2026-06', previousTotalCost: 8000, totalCostChangeRate: 0.25 },
};

function validNarrative(): string {
  return REPORT_REQUIRED_HEADINGS.map(
    (heading) =>
      `## ${heading}\nParágrafo com conteúdo suficiente para passar na validação de tamanho ` +
      'mínima exigida pelo relatório executivo mensal da frota.',
  ).join('\n\n');
}

describe('ReportService.generateMonthly', () => {
  const originalAiEnabled = process.env.AI_ENABLED;
  let service: ReportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportService();
    process.env.AI_ENABLED = 'true';
    buildAggregates.mockResolvedValue(AGGREGATES);
    prismaMock.aIReport.findFirst.mockResolvedValue(null);
    prismaMock.aIReport.upsert.mockResolvedValue({});
    prismaMock.aIReport.update.mockImplementation((args: { data: unknown }) => args.data);
  });

  afterAll(() => {
    process.env.AI_ENABLED = originalAiEnabled;
  });

  it('devolve o relatório existente sem reprocessar (idempotência)', async () => {
    prismaMock.aIReport.findFirst.mockResolvedValue({ id: 'ja-existe' });

    const result = await service.generateMonthly({ tenantId: 'tenant-1', period: '2026-07' });

    expect(result).toMatchObject({ id: 'ja-existe' });
    expect(invoke).not.toHaveBeenCalled();
    expect(prismaMock.aIReport.upsert).not.toHaveBeenCalled();
  });

  it('marca PENDING antes de chamar a IA', async () => {
    invoke.mockResolvedValue({ data: { text: validNarrative() } });

    await service.generateMonthly({ tenantId: 'tenant-1', period: '2026-07' });

    expect(prismaMock.aIReport.upsert.mock.calls[0]?.[0]?.create).toMatchObject({
      status: AIReportStatus.PENDING,
    });
  });

  it('gera com narrativa da IA e marca GENERATED', async () => {
    invoke
      .mockResolvedValueOnce({ data: { text: validNarrative() } })
      .mockResolvedValueOnce({ data: { text: 'Resumo curto do período.' } });

    await service.generateMonthly({ tenantId: 'tenant-1', period: '2026-07' });

    const data = prismaMock.aIReport.update.mock.calls[0]?.[0]?.data;
    expect(data.status).toBe(AIReportStatus.GENERATED);
    expect(data.summary).toBe('Resumo curto do período.');
    expect(data.dataSnapshot.degraded).toBe(false);
  });

  it('tenta 3 vezes e cai no tabular quando a IA sempre falha', async () => {
    invoke.mockRejectedValue(new Error('provider fora do ar'));

    await service.generateMonthly({ tenantId: 'tenant-1', period: '2026-07' });

    const data = prismaMock.aIReport.update.mock.calls[0]?.[0]?.data;
    expect(invoke).toHaveBeenCalledTimes(3);
    expect(data.status).toBe(AIReportStatus.GENERATED);
    expect(data.dataSnapshot.degraded).toBe(true);
    expect(data.content).toContain('modo tabular');
  });

  it('cai no tabular quando a narrativa não passa na validação', async () => {
    invoke.mockResolvedValue({ data: { text: '## Resumo Executivo\ncurto' } });

    await service.generateMonthly({ tenantId: 'tenant-1', period: '2026-07' });

    expect(prismaMock.aIReport.update.mock.calls[0]?.[0]?.data.dataSnapshot.degraded).toBe(true);
  });

  it('gera tabular sem chamar a IA quando AI_ENABLED está desligado', async () => {
    process.env.AI_ENABLED = 'false';

    await service.generateMonthly({ tenantId: 'tenant-1', period: '2026-07' });

    expect(invoke).not.toHaveBeenCalled();
    expect(prismaMock.aIReport.update.mock.calls[0]?.[0]?.data.dataSnapshot.degraded).toBe(true);
  });

  it('usa resumo determinístico quando o Haiku falha mas a narrativa saiu', async () => {
    invoke
      .mockResolvedValueOnce({ data: { text: validNarrative() } })
      .mockRejectedValueOnce(new Error('haiku fora'));

    await service.generateMonthly({ tenantId: 'tenant-1', period: '2026-07' });

    const data = prismaMock.aIReport.update.mock.calls[0]?.[0]?.data;
    expect(data.summary).toContain('2026-07');
    expect(data.dataSnapshot.degraded).toBe(false);
  });

  it('respeita o kind ON_DEMAND', async () => {
    invoke.mockResolvedValue({ data: { text: validNarrative() } });

    await service.generateMonthly({
      tenantId: 'tenant-1',
      period: '2026-07',
      kind: AIReportKind.ON_DEMAND,
    });

    expect(prismaMock.aIReport.findFirst.mock.calls[0]?.[0]?.where).toMatchObject({
      kind: AIReportKind.ON_DEMAND,
    });
  });
});
