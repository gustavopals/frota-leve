import type { TireRecord, TireStatus } from './tires.types';
import { DEFAULT_GROOVE_THRESHOLD_MM, TIRE_STATUS_LABELS } from './tires.constants';

export function formatTireStatus(status: TireStatus): string {
  return TIRE_STATUS_LABELS[status] ?? status;
}

export function formatGrooveDepth(mm: number): string {
  return `${mm.toFixed(1)} mm`;
}

export function formatTireLabel(tire: TireRecord): string {
  return `${tire.brand} ${tire.model} ${tire.size} — S/N ${tire.serialNumber}`;
}

export function formatVehicleLabel(vehicle: TireRecord['currentVehicle']): string {
  if (!vehicle) return '—';
  return `${vehicle.plate} — ${vehicle.brand} ${vehicle.model}`;
}

export function getWearPercentage(tire: TireRecord): number {
  if (tire.originalGrooveDepth <= 0) return 0;
  return Math.max(0, Math.min(100, (tire.currentGrooveDepth / tire.originalGrooveDepth) * 100));
}

export type TireHealthLevel = 'good' | 'warning' | 'critical' | 'discarded';

export function getTireHealthLevel(tire: TireRecord): TireHealthLevel {
  if (tire.status === 'DISCARDED') return 'discarded';
  if (tire.currentGrooveDepth <= DEFAULT_GROOVE_THRESHOLD_MM) return 'critical';
  const wear = getWearPercentage(tire);
  if (wear < 35) return 'warning';
  return 'good';
}

export const TIRE_HEALTH_COLOR: Record<TireHealthLevel, string> = {
  good: '#2dce89',
  warning: '#fb6340',
  critical: '#f5365c',
  discarded: '#adb5bd',
};

export const TIRE_HEALTH_LABEL: Record<TireHealthLevel, string> = {
  good: 'Bom estado',
  warning: 'Desgaste moderado',
  critical: 'Troca necessária',
  discarded: 'Descartado',
};

/** Normaliza código de posição (trim + uppercase) para comparar com o campo do banco */
export function normalizePosition(position: string | null | undefined): string {
  return (position ?? '').trim().toUpperCase();
}

export function formatInspectionDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
