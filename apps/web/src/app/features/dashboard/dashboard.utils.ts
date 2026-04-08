import type {
  DashboardAlertSeverity,
  DashboardAlertType,
} from '@frota-leve/shared/src/types/dashboard.type';
import { PoTagType } from '@po-ui/ng-components';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export type DashboardTagMeta = {
  label: string;
  type: PoTagType;
};

export function formatDashboardDate(value: string | Date | null | undefined): string {
  if (!value) {
    return 'Sem data definida';
  }

  return dateFormatter.format(new Date(value));
}

export function formatDashboardDateTime(value: string | Date | null | undefined): string {
  if (!value) {
    return 'Aguardando sincronizacao';
  }

  return dateTimeFormatter.format(new Date(value));
}

export function formatDashboardAlertDueAt(value: string | Date | null | undefined): string {
  if (!value) {
    return 'Sem prazo definido';
  }

  return `Prazo em ${formatDashboardDate(value)}`;
}

export function getDashboardAlertSeverityMeta(severity: DashboardAlertSeverity): DashboardTagMeta {
  switch (severity) {
    case 'high':
      return {
        label: 'Critico',
        type: PoTagType.Danger,
      };
    case 'medium':
      return {
        label: 'Atencao',
        type: PoTagType.Warning,
      };
    default:
      return {
        label: 'Monitorar',
        type: PoTagType.Neutral,
      };
  }
}

export function getDashboardAlertTypeLabel(type: DashboardAlertType): string {
  const labels: Record<DashboardAlertType, string> = {
    maintenance_due: 'Manutencao',
    documents_expiring: 'Documentos',
    driver_cnh_expiring: 'CNH',
    pending_fine: 'Multas',
  };

  return labels[type];
}

export function getDashboardActivityActionLabel(action: string): string {
  const labels: Record<string, string> = {
    VEHICLE_CREATED: 'Veiculo cadastrado',
    VEHICLE_UPDATED: 'Veiculo atualizado',
    VEHICLE_STATUS_CHANGED: 'Status alterado',
    VEHICLE_MILEAGE_UPDATED: 'Quilometragem atualizada',
    VEHICLE_IMPORTED: 'Importacao de veiculo',
    DRIVER_CREATED: 'Motorista cadastrado',
    DRIVER_UPDATED: 'Motorista atualizado',
    DRIVER_IMPORTED: 'Importacao de motorista',
    DRIVER_VEHICLE_LINKED: 'Vinculo motorista-veiculo',
    DRIVER_DELETED: 'Motorista desativado',
  };

  return labels[action] ?? action.replace(/_/g, ' ');
}

export function getDashboardVariationLabel(variation: number): string {
  if (variation === 0) {
    return 'Estavel em relacao ao mes anterior';
  }

  return `${variation > 0 ? '+' : ''}${variation.toFixed(1)}% vs mes anterior`;
}
