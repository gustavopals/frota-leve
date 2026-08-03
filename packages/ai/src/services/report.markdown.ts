import { REPORT_REQUIRED_HEADINGS } from '../prompts/system/report.v1';
import type { MonthlyReportData } from '../context/monthly-aggregates.types';

function brl(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function percent(rate: number | null): string {
  if (rate === null) {
    return 'sem base de comparação';
  }

  const signal = rate >= 0 ? '+' : '';
  return `${signal}${(rate * 100).toFixed(1)}%`;
}

/**
 * Relatório tabular sem narrativa (TASK 3.5.4).
 *
 * Usado quando o Claude falha ou a quota acaba. Mantém as mesmas seções da
 * versão com IA para que a tela e o PDF não precisem saber qual das duas gerou
 * o conteúdo — muda a densidade do texto, não a estrutura.
 */
export function buildDegradedReportMarkdown(data: MonthlyReportData): string {
  const categories = data.costByCategory.length
    ? data.costByCategory.map((item) => `- ${item.category}: ${brl(item.total)}`).join('\n')
    : '- Sem custos registrados no período.';

  const topVehicles = data.topVehiclesByCostPerKm.length
    ? data.topVehiclesByCostPerKm
        .map(
          (item) =>
            `- ${item.plate}: ${brl(item.totalCost)} em ${item.distanceKm} km (${
              item.costPerKm === null ? 'sem km/l' : `${brl(item.costPerKm)}/km`
            })`,
        )
        .join('\n')
    : '- Sem quilometragem medida no período.';

  const anomalies = data.highAnomalies.length
    ? data.highAnomalies.map((item) => `- ${item.message}`).join('\n')
    : '- Nenhuma anomalia de severidade alta.';

  return [
    `## ${REPORT_REQUIRED_HEADINGS[0]}`,
    `Frota de ${data.fleetSize} veículo(s). Custo total do período: ${brl(data.totalCost)}.`,
    'Relatório gerado em modo tabular, sem narrativa de IA.',
    '',
    `## ${REPORT_REQUIRED_HEADINGS[1]}`,
    `Custo por categoria:`,
    categories,
    '',
    'Maiores custos por km:',
    topVehicles,
    '',
    `## ${REPORT_REQUIRED_HEADINGS[2]}`,
    anomalies,
    '',
    `Multas: ${data.fines.count} (${brl(data.fines.totalAmount)}, ${data.fines.totalPoints} pontos).`,
    `Manutenções concluídas: ${data.maintenance.completed}. Pendentes: ${data.maintenance.pending}.`,
    '',
    `## ${REPORT_REQUIRED_HEADINGS[3]}`,
    '- Revisar os veículos com maior custo por km listados acima.',
    '- Tratar as anomalias de severidade alta ainda abertas.',
    '',
    `## ${REPORT_REQUIRED_HEADINGS[4]}`,
    `Período anterior (${data.comparison.previousPeriod}): ${brl(data.comparison.previousTotalCost)}.`,
    `Variação: ${percent(data.comparison.totalCostChangeRate)}.`,
    '',
    `## ${REPORT_REQUIRED_HEADINGS[5]}`,
    '- Acompanhar a evolução do custo por km dos veículos destacados.',
    '- Reavaliar este relatório quando a geração por IA estiver disponível.',
    '',
  ].join('\n');
}

/** Resumo determinístico usado quando o Haiku não roda. */
export function buildDegradedSummary(data: MonthlyReportData): string {
  return [
    `Custo total de ${brl(data.totalCost)} em ${data.period}, com ${data.fleetSize} veículo(s).`,
    `Variação vs. ${data.comparison.previousPeriod}: ${percent(data.comparison.totalCostChangeRate)}.`,
    `${data.fines.count} multa(s) e ${data.highAnomalies.length} anomalia(s) de severidade alta.`,
  ].join(' ');
}
