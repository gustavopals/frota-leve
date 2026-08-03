/** Badges de gamificação do motorista (TASK 3.7.6). Calculadas em código, sem IA. */

export type DriverBadgeCode = 'ECONOMICO' | 'ZERO_MULTAS_90D' | 'CHECKLIST_EM_DIA_30D';

export interface DriverBadge {
  code: DriverBadgeCode;
  label: string;
  description: string;
}

export interface DriverBadgeInput {
  /** Percentil do motorista em consumo, por mês (mais recente primeiro). */
  fuelPercentileByMonth: number[];
  finesInLast90Days: number;
  checklistsCompletedLast30Days: number;
  checklistsExpectedLast30Days: number;
}

const BADGES: Record<DriverBadgeCode, Omit<DriverBadge, 'code'>> = {
  ECONOMICO: {
    label: 'Econômico',
    description: 'Top 20% em consumo por 3 meses seguidos.',
  },
  ZERO_MULTAS_90D: {
    label: 'Zero Multas 90d',
    description: 'Nenhuma multa nos últimos 90 dias.',
  },
  CHECKLIST_EM_DIA_30D: {
    label: 'Checklist em dia 30d',
    description: 'Todos os checklists entregues nos últimos 30 dias.',
  },
};

/**
 * Avalia as badges do motorista.
 *
 * "Top 20%" usa percentil >= 80 nos três meses mais recentes — meses faltando
 * reprovam a badge, porque a conquista é sobre consistência.
 */
export function computeDriverBadges(input: DriverBadgeInput): DriverBadge[] {
  const earned: DriverBadgeCode[] = [];

  const lastThree = input.fuelPercentileByMonth.slice(0, 3);

  if (lastThree.length === 3 && lastThree.every((percentile) => percentile >= 80)) {
    earned.push('ECONOMICO');
  }

  if (input.finesInLast90Days === 0) {
    earned.push('ZERO_MULTAS_90D');
  }

  if (
    input.checklistsExpectedLast30Days > 0 &&
    input.checklistsCompletedLast30Days >= input.checklistsExpectedLast30Days
  ) {
    earned.push('CHECKLIST_EM_DIA_30D');
  }

  return earned.map((code) => ({ code, ...BADGES[code] }));
}
