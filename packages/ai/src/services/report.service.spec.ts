import { validateReportContent } from './report.service';
import { buildDegradedReportMarkdown, buildDegradedSummary } from './report.markdown';
import { REPORT_REQUIRED_HEADINGS } from '../prompts/system/report.v1';
import type { MonthlyReportData } from '../context/monthly-aggregates.types';

const DATA: MonthlyReportData = {
  tenantId: 't1',
  period: '2026-07',
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-08-01T00:00:00.000Z',
  fleetSize: 12,
  totalCost: 48250.75,
  costByCategory: [
    { category: 'LIGHT', total: 30000 },
    { category: 'HEAVY', total: 18250.75 },
  ],
  topVehiclesByCostPerKm: [
    { vehicleId: 'v1', plate: 'ABC1D23', totalCost: 5000, distanceKm: 2000, costPerKm: 2.5 },
  ],
  fuel: {
    totalLiters: 3200,
    totalCost: 25000,
    averageKmPerLiter: 8.4,
    kmPerLiterStdDev: 0.9,
    recordCount: 88,
  },
  maintenance: { completed: 7, pending: 3, totalCost: 20000 },
  fines: { count: 4, totalAmount: 3250.75, totalPoints: 16 },
  highAnomalies: [
    {
      kind: 'MAINT_COST',
      severity: 'HIGH',
      message: 'Custo de manutenção acima do p90 dos pares.',
      detectedAt: '2026-07-20T03:00:00.000Z',
    },
  ],
  comparison: {
    previousPeriod: '2026-06',
    previousTotalCost: 40000,
    totalCostChangeRate: 0.2062,
  },
};

function buildValidNarrative(): string {
  return REPORT_REQUIRED_HEADINGS.map(
    (heading) =>
      `## ${heading}\nTexto suficientemente longo para o relatório executivo desta seção, ` +
      'cobrindo números, placas e variações relevantes do período analisado.',
  ).join('\n\n');
}

describe('validateReportContent', () => {
  it('aceita markdown com todas as seções e tamanho mínimo', () => {
    expect(validateReportContent(buildValidNarrative()).valid).toBe(true);
  });

  it('recusa quando falta uma seção obrigatória', () => {
    const withoutRecommendations = buildValidNarrative().replace('## Recomendações', '## Outras');
    const result = validateReportContent(withoutRecommendations);

    expect(result.valid).toBe(false);
    expect(result.missingHeadings).toContain('Recomendações');
  });

  it('recusa markdown com as seções certas mas praticamente vazio', () => {
    const skeleton = REPORT_REQUIRED_HEADINGS.map((heading) => `## ${heading}`).join('\n');
    const result = validateReportContent(skeleton);

    expect(result.valid).toBe(false);
    expect(result.tooShort).toBe(true);
  });
});

describe('buildDegradedReportMarkdown', () => {
  it('produz as mesmas seções da versão com IA', () => {
    const markdown = buildDegradedReportMarkdown(DATA);

    for (const heading of REPORT_REQUIRED_HEADINGS) {
      expect(markdown).toContain(`## ${heading}`);
    }
  });

  it('passa na mesma validação aplicada à narrativa da IA', () => {
    expect(validateReportContent(buildDegradedReportMarkdown(DATA)).valid).toBe(true);
  });

  it('cita os números do período', () => {
    const markdown = buildDegradedReportMarkdown(DATA);

    expect(markdown).toContain('ABC1D23');
    expect(markdown).toContain('12 veículo(s)');
    expect(markdown).toContain('2026-06');
  });

  it('não quebra quando o período não tem movimento', () => {
    const empty: MonthlyReportData = {
      ...DATA,
      totalCost: 0,
      costByCategory: [],
      topVehiclesByCostPerKm: [],
      highAnomalies: [],
      comparison: { previousPeriod: '2026-06', previousTotalCost: 0, totalCostChangeRate: null },
    };

    const markdown = buildDegradedReportMarkdown(empty);

    expect(markdown).toContain('Sem custos registrados no período.');
    expect(markdown).toContain('sem base de comparação');
    expect(validateReportContent(markdown).valid).toBe(true);
  });
});

describe('buildDegradedSummary', () => {
  it('resume período, variação e ocorrências', () => {
    const summary = buildDegradedSummary(DATA);

    expect(summary).toContain('2026-07');
    expect(summary).toContain('+20.6%');
    expect(summary).toContain('4 multa(s)');
  });
});
