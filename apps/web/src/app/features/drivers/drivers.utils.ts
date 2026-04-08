import { PoTagType } from '@po-ui/ng-components';
import { formatCPF, formatPhone, formatPlate } from '@frota-leve/shared/src/utils/format.utils';
import { isValidCPF } from '@frota-leve/shared/src/utils/validation.utils';
import { VEHICLE_STATUS_LABELS } from '../vehicles/vehicles.constants';
import type { DriverHistoryEntry, DriverHistoryVehicle } from './drivers.types';

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

export type DriverCnhState = 'missing' | 'valid' | 'expiring' | 'expired';

export type DriverVisualMeta = {
  label: string;
  type: PoTagType;
  helper: string;
};

export function extractDigits(value: string | null | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function sanitizePhoneDigits(value: string | null | undefined): string | undefined {
  const digits = extractDigits(value).slice(0, 11);
  return digits ? digits : undefined;
}

export function maskCpfInput(value: string): string {
  const digits = extractDigits(value).slice(0, 11);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  }

  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function maskPhoneInput(value: string): string {
  const digits = extractDigits(value).slice(0, 11);

  if (digits.length === 0) {
    return '';
  }

  if (digits.length <= 2) {
    return `(${digits}`;
  }

  const ddd = digits.slice(0, 2);
  const phone = digits.slice(2);

  if (digits.length <= 6) {
    return `(${ddd}) ${phone}`;
  }

  if (digits.length <= 10) {
    return `(${ddd}) ${phone.slice(0, 4)}-${phone.slice(4)}`;
  }

  return `(${ddd}) ${phone.slice(0, 5)}-${phone.slice(5)}`;
}

export function validateDriverCpf(value: string): boolean {
  return isValidCPF(extractDigits(value));
}

export function validateDriverPhone(value: string): boolean {
  const digits = extractDigits(value);
  return digits.length === 10 || digits.length === 11;
}

export function formatDriverCpf(value: string | null | undefined): string {
  const digits = extractDigits(value);
  return digits.length === 11 ? formatCPF(digits) : 'Não informado';
}

export function formatDriverPhone(value: string | null | undefined): string {
  const digits = extractDigits(value);

  if (!digits) {
    return 'Não informado';
  }

  return digits.length === 10 || digits.length === 11 ? formatPhone(digits) : (value ?? digits);
}

export function formatDriverDate(value: string | Date | null | undefined): string {
  if (!value) {
    return 'Não informado';
  }

  return dateFormatter.format(new Date(value));
}

export function formatDriverDateTime(value: string | Date | null | undefined): string {
  if (!value) {
    return 'Não informado';
  }

  return dateTimeFormatter.format(new Date(value));
}

export function toIsoDateInputValue(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString().slice(0, 10);
}

export function getDriverStatusMeta(isActive: boolean): DriverVisualMeta {
  return isActive
    ? {
        label: 'Ativo',
        type: PoTagType.Success,
        helper: 'Disponível para operação',
      }
    : {
        label: 'Inativo',
        type: PoTagType.Danger,
        helper: 'Fora da escala operacional',
      };
}

export function getDriverScoreMeta(score: number | null | undefined): DriverVisualMeta {
  if (score == null) {
    return {
      label: 'Sem score',
      type: PoTagType.Neutral,
      helper: 'Pontuação ainda não calculada',
    };
  }

  if (score >= 90) {
    return {
      label: 'Excelente',
      type: PoTagType.Success,
      helper: `${score.toFixed(1)} pontos`,
    };
  }

  if (score >= 75) {
    return {
      label: 'Atenção',
      type: PoTagType.Warning,
      helper: `${score.toFixed(1)} pontos`,
    };
  }

  return {
    label: 'Crítico',
    type: PoTagType.Danger,
    helper: `${score.toFixed(1)} pontos`,
  };
}

export function getDriverCnhState(value: string | Date | null | undefined): DriverCnhState {
  if (!value) {
    return 'missing';
  }

  const expiration = new Date(value);

  if (Number.isNaN(expiration.getTime())) {
    return 'missing';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(expiration);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'expired';
  }

  if (diffDays <= 30) {
    return 'expiring';
  }

  return 'valid';
}

export function getDriverCnhMeta(value: string | Date | null | undefined): DriverVisualMeta {
  const state = getDriverCnhState(value);

  switch (state) {
    case 'expired':
      return {
        label: 'Vencida',
        type: PoTagType.Danger,
        helper: `Validade em ${formatDriverDate(value)}`,
      };
    case 'expiring':
      return {
        label: 'Até 30 dias',
        type: PoTagType.Warning,
        helper: `Validade em ${formatDriverDate(value)}`,
      };
    case 'valid':
      return {
        label: 'Em dia',
        type: PoTagType.Success,
        helper: `Validade em ${formatDriverDate(value)}`,
      };
    default:
      return {
        label: 'Sem controle',
        type: PoTagType.Neutral,
        helper: 'Nenhum vencimento informado',
      };
  }
}

export function getDriverTimelineActionLabel(action: string): string {
  const labels: Record<string, string> = {
    DRIVER_CREATED: 'Motorista criado',
    DRIVER_UPDATED: 'Cadastro atualizado',
    DRIVER_DELETED: 'Perfil desativado',
    DRIVER_IMPORTED: 'Motorista importado',
    DRIVER_VEHICLE_LINKED: 'Veículo vinculado',
  };

  return labels[action] ?? action.replace(/_/g, ' ');
}

export function getDriverAuditSummary(item: DriverHistoryEntry): string {
  if (!item.changes || typeof item.changes !== 'object') {
    return 'Sem detalhes adicionais';
  }

  const changes = item.changes as Record<string, unknown>;

  if (changes['source'] === 'import') {
    return `Importado pela linha ${String(changes['row'] ?? '?')}`;
  }

  if (typeof changes['vehiclePlate'] === 'string') {
    return `Condutor principal vinculado ao veículo ${formatPlate(changes['vehiclePlate'])}`;
  }

  if ('after' in changes && 'before' in changes) {
    return 'Registro atualizado com trilha comparativa de auditoria';
  }

  return 'Evento registrado para acompanhamento operacional';
}

export function formatAssignedVehicle(vehicle: DriverHistoryVehicle): string {
  return `${formatPlate(vehicle.plate)} • ${vehicle.brand} ${vehicle.model}`;
}

export function formatAssignedVehicleStatus(status: string): string {
  if (status in VEHICLE_STATUS_LABELS) {
    return VEHICLE_STATUS_LABELS[status as keyof typeof VEHICLE_STATUS_LABELS];
  }

  return status;
}
