import { formatCurrency, formatPlate } from '@frota-leve/shared/src/utils/format.utils';
import { isValidPlate } from '@frota-leve/shared/src/utils/validation.utils';
import {
  FUEL_TYPE_LABELS,
  VEHICLE_CATEGORY_LABELS,
  VEHICLE_STATUS_LABELS,
} from './vehicles.constants';
import type { VehicleTimelineItem } from './vehicles.types';

const kilometerFormatter = new Intl.NumberFormat('pt-BR');
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

export function formatVehiclePlate(value: string | null | undefined): string {
  return value ? formatPlate(value) : 'Sem placa';
}

export function formatVehicleKilometers(value: number | null | undefined): string {
  if (value == null) {
    return '0 km';
  }

  return `${kilometerFormatter.format(value)} km`;
}

export function formatVehicleCurrency(value: number | null | undefined): string {
  if (value == null) {
    return 'Não informado';
  }

  return formatCurrency(value);
}

export function formatVehicleDate(value: string | Date | null | undefined): string {
  if (!value) {
    return 'Não informado';
  }

  return dateFormatter.format(new Date(value));
}

export function formatVehicleDateTime(value: string | Date | null | undefined): string {
  if (!value) {
    return 'Não informado';
  }

  return dateTimeFormatter.format(new Date(value));
}

export function formatVehicleStatus(value: keyof typeof VEHICLE_STATUS_LABELS): string {
  return VEHICLE_STATUS_LABELS[value];
}

export function formatVehicleCategory(value: keyof typeof VEHICLE_CATEGORY_LABELS): string {
  return VEHICLE_CATEGORY_LABELS[value];
}

export function formatFuelType(value: keyof typeof FUEL_TYPE_LABELS): string {
  return FUEL_TYPE_LABELS[value];
}

export function maskVehiclePlateInput(value: string): string {
  const normalized = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7);
  const prefix = normalized.slice(0, 3);
  const suffix = normalized.slice(3);

  if (suffix.length === 0) {
    return prefix;
  }

  if (/^\d{0,4}$/.test(suffix)) {
    return `${prefix}-${suffix}`;
  }

  return `${prefix}${suffix}`;
}

export function validateVehiclePlate(value: string): boolean {
  return isValidPlate(value);
}

export function toIsoDateInputValue(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString().slice(0, 10);
}

export function downloadBlob(fileName: string, blob: Blob): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();

  URL.revokeObjectURL(objectUrl);
}

export function getTimelineActionLabel(action: string): string {
  const labels: Record<string, string> = {
    VEHICLE_CREATED: 'Veículo criado',
    VEHICLE_UPDATED: 'Cadastro atualizado',
    VEHICLE_STATUS_CHANGED: 'Status alterado',
    VEHICLE_MILEAGE_UPDATED: 'Quilometragem atualizada',
    VEHICLE_IMPORTED: 'Veículo importado',
    VEHICLE_DELETED: 'Veículo baixado',
  };

  return labels[action] ?? action.replace(/_/g, ' ');
}

export function getTimelineChangeSummary(item: VehicleTimelineItem): string {
  if (!item.changes || typeof item.changes !== 'object') {
    return 'Sem detalhes adicionais';
  }

  const changes = item.changes as Record<string, unknown>;

  if (changes['source'] === 'import') {
    return `Importado pela linha ${String(changes['row'] ?? '?')}`;
  }

  if ('after' in changes && 'before' in changes) {
    return 'Registro comparativo disponível no log';
  }

  return 'Alteração registrada para auditoria';
}
