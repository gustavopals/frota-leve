import { formatCPF, formatPlate } from '@frota-leve/shared/src/utils/format.utils';
import type { FuelType } from '@frota-leve/shared/src/enums/fuel-type.enum';
import { FUEL_TYPE_LABELS } from './fuel.constants';
import type { FuelRecord, FuelRecordVehicle } from './fuel.types';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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

export function formatFuelCurrency(value: number | null | undefined): string {
  if (value == null) return 'Não informado';
  return currencyFormatter.format(value);
}

export function formatFuelNumber(value: number | null | undefined, suffix = ''): string {
  if (value == null) return 'Não informado';
  return `${numberFormatter.format(value)}${suffix}`;
}

export function formatFuelDate(value: string | Date | null | undefined): string {
  if (!value) return 'Não informado';
  return dateFormatter.format(new Date(value));
}

export function formatFuelDateTime(value: string | Date | null | undefined): string {
  if (!value) return 'Não informado';
  return dateTimeFormatter.format(new Date(value));
}

export function formatFuelType(fuelType: FuelType | string): string {
  return FUEL_TYPE_LABELS[fuelType as FuelType] ?? fuelType;
}

export function formatVehicleLabel(vehicle: FuelRecordVehicle): string {
  return `${formatPlate(vehicle.plate)} • ${vehicle.brand} ${vehicle.model} ${vehicle.year}`;
}

export function formatFuelDriverLabel(name: string, cpf: string | null | undefined): string {
  const formattedCpf = cpf ? formatCPF(cpf) : 'CPF não informado';
  return `${name} • ${formattedCpf}`;
}

export function formatKmPerLiter(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${numberFormatter.format(value)} km/l`;
}

export function formatMileage(value: number | null | undefined): string {
  if (value == null) return 'Não informado';
  return `${value.toLocaleString('pt-BR')} km`;
}

export function toIsoDateInputValue(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

export function isAnomaly(record: FuelRecord): boolean {
  return record.anomaly;
}
