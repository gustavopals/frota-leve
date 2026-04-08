import type { Prisma } from '@frota-leve/database';
import { TireStatus } from '@frota-leve/database';
import type { TireReplacementAlertItem } from './tires.types';

export const TIRE_ENTITY = 'Tire';
export const TIRE_REPLACEMENT_ALERT_ACTION = 'TIRE_REPLACEMENT_ALERT';
export const TIRE_REPLACEMENT_ALERT_SCHEDULER_USER_AGENT = 'tire-replacement-alert-scheduler';
export const DEFAULT_TIRE_REPLACEMENT_THRESHOLD = 3;
export const MAX_TIRE_REPLACEMENT_THRESHOLD = 20;

export function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateRemainingUsefulLifePercentage(
  currentGrooveDepth: number,
  originalGrooveDepth: number,
): number {
  if (originalGrooveDepth <= 0) {
    return 0;
  }

  return roundToTwoDecimals((currentGrooveDepth / originalGrooveDepth) * 100);
}

export function calculateMmBelowThreshold(currentGrooveDepth: number, threshold: number): number {
  return roundToTwoDecimals(Math.max(threshold - currentGrooveDepth, 0));
}

export function compareReplacementAlertUrgency(
  a: TireReplacementAlertItem,
  b: TireReplacementAlertItem,
): number {
  if (a.currentGrooveDepth !== b.currentGrooveDepth) {
    return a.currentGrooveDepth - b.currentGrooveDepth;
  }

  if (a.mmBelowThreshold !== b.mmBelowThreshold) {
    return b.mmBelowThreshold - a.mmBelowThreshold;
  }

  if (a.updatedAt.getTime() !== b.updatedAt.getTime()) {
    return a.updatedAt.getTime() - b.updatedAt.getTime();
  }

  return a.serialNumber.localeCompare(b.serialNumber);
}

export function buildTireReplacementAlertWhere(
  tenantId: string | undefined,
  threshold: number,
  vehicleId?: string,
): Prisma.TireWhereInput {
  return {
    ...(tenantId ? { tenantId } : {}),
    status: TireStatus.IN_USE,
    currentVehicleId: {
      ...(vehicleId ? { equals: vehicleId } : { not: null }),
    },
    position: {
      not: null,
    },
    currentGrooveDepth: {
      lt: threshold,
    },
  };
}

export function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}
