import { MaintenanceType } from '@frota-leve/shared/src/enums/maintenance-type.enum';
import type {
  MaintenancePlanRecord,
  MaintenancePlanVehicle,
  MaintenancePlanVisualStatus,
} from './maintenance.types';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 0,
});

export const MAINTENANCE_UPCOMING_DAYS_THRESHOLD = 30;
export const MAINTENANCE_UPCOMING_KM_THRESHOLD = 1000;

export function formatMaintenanceDate(value: string | null): string {
  if (!value) {
    return 'Sem data';
  }

  return dateFormatter.format(new Date(value));
}

export function formatMaintenanceMileage(value: number | null): string {
  if (value === null) {
    return 'Sem km';
  }

  return `${numberFormatter.format(value)} km`;
}

export function formatMaintenanceType(type: MaintenanceType): string {
  switch (type) {
    case MaintenanceType.PREVENTIVE:
      return 'Preventiva';
    case MaintenanceType.CORRECTIVE:
      return 'Corretiva';
    case MaintenanceType.PREDICTIVE:
      return 'Preditiva';
    default:
      return type;
  }
}

export function formatMaintenanceVehicleLabel(vehicle: MaintenancePlanVehicle): string {
  return `${vehicle.plate} • ${vehicle.brand} ${vehicle.model}`;
}

export function formatMaintenanceInterval(
  plan: Pick<MaintenancePlanRecord, 'intervalKm' | 'intervalDays'>,
): string {
  const parts: string[] = [];

  if (plan.intervalKm !== null) {
    parts.push(formatMaintenanceMileage(plan.intervalKm));
  }

  if (plan.intervalDays !== null) {
    parts.push(`${numberFormatter.format(plan.intervalDays)} dias`);
  }

  return parts.length > 0 ? parts.join(' • ') : 'Sob demanda';
}

export function formatLastExecution(
  plan: Pick<MaintenancePlanRecord, 'lastExecutedAt' | 'lastExecutedMileage'>,
): string {
  const parts: string[] = [];

  if (plan.lastExecutedAt) {
    parts.push(formatMaintenanceDate(plan.lastExecutedAt));
  }

  if (plan.lastExecutedMileage !== null) {
    parts.push(formatMaintenanceMileage(plan.lastExecutedMileage));
  }

  return parts.length > 0 ? `Última execução: ${parts.join(' • ')}` : 'Sem histórico de execução';
}

export function getRemainingDays(
  nextDueAt: string | null,
  referenceDate: Date = new Date(),
): number | null {
  if (!nextDueAt) {
    return null;
  }

  const diffMs = new Date(nextDueAt).getTime() - referenceDate.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function getRemainingKm(
  plan: Pick<MaintenancePlanRecord, 'nextDueMileage' | 'vehicle'>,
): number | null {
  if (plan.nextDueMileage === null) {
    return null;
  }

  return plan.nextDueMileage - plan.vehicle.currentMileage;
}

export function getMaintenancePlanVisualStatus(
  plan: MaintenancePlanRecord,
  referenceDate: Date = new Date(),
): MaintenancePlanVisualStatus {
  if (!plan.isActive) {
    return 'inactive';
  }

  if (plan.isOverdue) {
    return 'overdue';
  }

  const remainingDays = getRemainingDays(plan.nextDueAt, referenceDate);
  const remainingKm = getRemainingKm(plan);

  if (
    (remainingDays !== null && remainingDays <= MAINTENANCE_UPCOMING_DAYS_THRESHOLD) ||
    (remainingKm !== null && remainingKm <= MAINTENANCE_UPCOMING_KM_THRESHOLD)
  ) {
    return 'upcoming';
  }

  return 'healthy';
}

export function getMaintenanceStatusLabel(status: MaintenancePlanVisualStatus): string {
  switch (status) {
    case 'healthy':
      return 'Em dia';
    case 'upcoming':
      return 'Próximo';
    case 'overdue':
      return 'Vencido';
    case 'inactive':
      return 'Inativo';
    default:
      return 'Em dia';
  }
}

export function getMaintenanceStatusHelper(
  plan: MaintenancePlanRecord,
  status: MaintenancePlanVisualStatus,
  referenceDate: Date = new Date(),
): string {
  if (status === 'inactive') {
    return 'Plano pausado. Não participa da cadência automática.';
  }

  const remainingDays = getRemainingDays(plan.nextDueAt, referenceDate);
  const remainingKm = getRemainingKm(plan);
  const parts: string[] = [];

  if (status === 'overdue') {
    if (plan.dueReasons.includes('date')) {
      parts.push(
        remainingDays !== null && remainingDays < 0
          ? `data vencida há ${numberFormatter.format(Math.abs(remainingDays))} dias`
          : 'data vencida',
      );
    }

    if (plan.dueReasons.includes('mileage')) {
      parts.push(
        remainingKm !== null && remainingKm < 0
          ? `${formatMaintenanceMileage(Math.abs(remainingKm))} acima do previsto`
          : 'quilometragem vencida',
      );
    }

    return parts.join(' • ') || 'Plano fora da janela de revisão.';
  }

  if (remainingDays !== null) {
    parts.push(
      status === 'upcoming'
        ? `vence em ${numberFormatter.format(Math.max(remainingDays, 0))} dias`
        : `janela em ${numberFormatter.format(remainingDays)} dias`,
    );
  }

  if (remainingKm !== null) {
    parts.push(
      status === 'upcoming'
        ? `faltam ${formatMaintenanceMileage(Math.max(remainingKm, 0))}`
        : `${formatMaintenanceMileage(remainingKm)} até o gatilho`,
    );
  }

  return parts.join(' • ') || 'Plano aguardando próxima configuração de vencimento.';
}

export function getNextDueSummary(plan: MaintenancePlanRecord): {
  primary: string;
  secondary: string;
} {
  const primary = plan.nextDueAt
    ? `Data: ${formatMaintenanceDate(plan.nextDueAt)}`
    : plan.nextDueMileage !== null
      ? `Km: ${formatMaintenanceMileage(plan.nextDueMileage)}`
      : 'Sob demanda';

  const secondary =
    plan.nextDueAt && plan.nextDueMileage !== null
      ? `ou ${formatMaintenanceMileage(plan.nextDueMileage)}`
      : plan.nextDueAt
        ? 'gatilho por calendário'
        : plan.nextDueMileage !== null
          ? 'gatilho por quilometragem'
          : 'sem gatilho ativo';

  return {
    primary,
    secondary,
  };
}
