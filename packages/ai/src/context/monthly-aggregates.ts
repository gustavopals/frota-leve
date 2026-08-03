import { AIAnomalySeverity, ServiceOrderStatus, VehicleStatus, prisma } from '@frota-leve/database';
import { mean, standardDeviation } from '../services/statistics';
import type { MonthlyReportData, MonthlyVehicleCost } from './monthly-aggregates.types';

const TOP_VEHICLES = 5;

/** `YYYY-MM` → intervalo UTC `[start, end)`. */
export function resolvePeriodRange(period: string): { start: Date; end: Date } {
  const [yearRaw, monthRaw] = period.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Período inválido: ${period}. Use o formato YYYY-MM.`);
  }

  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

export function previousPeriod(period: string): string {
  const { start } = resolvePeriodRange(period);
  const previous = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));

  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function sumPeriodCost(tenantId: string, start: Date, end: Date): Promise<number> {
  const [fuel, orders, fines] = await Promise.all([
    prisma.fuelRecord.aggregate({
      where: { tenantId, date: { gte: start, lt: end } },
      _sum: { totalCost: true },
    }),
    prisma.serviceOrder.aggregate({
      where: { tenantId, endDate: { gte: start, lt: end } },
      _sum: { totalCost: true },
    }),
    prisma.fine.aggregate({
      where: { tenantId, date: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
  ]);

  return (fuel._sum.totalCost ?? 0) + (orders._sum.totalCost ?? 0) + (fines._sum.amount ?? 0);
}

/**
 * Monta os agregados do mês para um tenant (TASK 3.5.1).
 *
 * Todas as consultas são escopadas por `tenantId`. O custo/km por veículo usa a
 * variação do odômetro nos abastecimentos do período — mesmo critério da
 * detecção de anomalias, para os dois números não se contradizerem.
 */
export async function buildMonthlyAggregates(
  tenantId: string,
  period: string,
): Promise<MonthlyReportData> {
  const { start, end } = resolvePeriodRange(period);
  const priorPeriod = previousPeriod(period);
  const priorRange = resolvePeriodRange(priorPeriod);

  const [vehicles, fuelRecords, serviceOrders, pendingOrders, fines, anomalies, previousTotalCost] =
    await Promise.all([
      prisma.vehicle.findMany({
        where: { tenantId, status: { not: VehicleStatus.DECOMMISSIONED } },
        select: { id: true, plate: true, category: true },
      }),
      prisma.fuelRecord.findMany({
        where: { tenantId, date: { gte: start, lt: end } },
        select: { vehicleId: true, liters: true, totalCost: true, mileage: true, kmPerLiter: true },
      }),
      prisma.serviceOrder.findMany({
        where: { tenantId, endDate: { gte: start, lt: end } },
        select: { vehicleId: true, totalCost: true },
      }),
      prisma.serviceOrder.count({
        where: {
          tenantId,
          status: {
            in: [
              ServiceOrderStatus.OPEN,
              ServiceOrderStatus.APPROVED,
              ServiceOrderStatus.IN_PROGRESS,
            ],
          },
        },
      }),
      prisma.fine.findMany({
        where: { tenantId, date: { gte: start, lt: end } },
        select: { vehicleId: true, amount: true, points: true },
      }),
      prisma.aIAnomaly.findMany({
        where: {
          tenantId,
          severity: AIAnomalySeverity.HIGH,
          detectedAt: { gte: start, lt: end },
        },
        select: { kind: true, severity: true, message: true, detectedAt: true },
        orderBy: { detectedAt: 'desc' },
      }),
      sumPeriodCost(tenantId, priorRange.start, priorRange.end),
    ]);

  const categoryByVehicle = new Map(vehicles.map((v) => [v.id, String(v.category)]));
  const plateByVehicle = new Map(vehicles.map((v) => [v.id, v.plate]));

  const fuelCost = fuelRecords.reduce((total, record) => total + record.totalCost, 0);
  const maintenanceCost = serviceOrders.reduce((total, order) => total + order.totalCost, 0);
  const fineAmount = fines.reduce((total, fine) => total + fine.amount, 0);
  const totalCost = fuelCost + maintenanceCost + fineAmount;

  // Custo por categoria de veículo, somando as três fontes de despesa.
  const costByCategoryMap = new Map<string, number>();

  function addCost(vehicleId: string, value: number): void {
    const category = categoryByVehicle.get(vehicleId) ?? 'DESCONHECIDA';
    costByCategoryMap.set(category, (costByCategoryMap.get(category) ?? 0) + value);
  }

  for (const record of fuelRecords) {
    addCost(record.vehicleId, record.totalCost);
  }
  for (const order of serviceOrders) {
    addCost(order.vehicleId, order.totalCost);
  }
  for (const fine of fines) {
    addCost(fine.vehicleId, fine.amount);
  }

  // Custo e distância por veículo para o ranking de custo/km.
  const perVehicle = new Map<string, { cost: number; min: number; max: number; seen: boolean }>();

  function vehicleBucket(vehicleId: string) {
    let bucket = perVehicle.get(vehicleId);

    if (!bucket) {
      bucket = { cost: 0, min: Infinity, max: -Infinity, seen: false };
      perVehicle.set(vehicleId, bucket);
    }

    return bucket;
  }

  for (const record of fuelRecords) {
    const bucket = vehicleBucket(record.vehicleId);
    bucket.cost += record.totalCost;
    bucket.min = Math.min(bucket.min, record.mileage);
    bucket.max = Math.max(bucket.max, record.mileage);
    bucket.seen = true;
  }
  for (const order of serviceOrders) {
    vehicleBucket(order.vehicleId).cost += order.totalCost;
  }
  for (const fine of fines) {
    vehicleBucket(fine.vehicleId).cost += fine.amount;
  }

  const topVehiclesByCostPerKm: MonthlyVehicleCost[] = [...perVehicle.entries()]
    .map(([vehicleId, bucket]) => {
      const distanceKm = bucket.seen ? Math.max(0, bucket.max - bucket.min) : 0;

      return {
        vehicleId,
        plate: plateByVehicle.get(vehicleId) ?? '—',
        totalCost: Number(bucket.cost.toFixed(2)),
        distanceKm,
        costPerKm: distanceKm > 0 ? Number((bucket.cost / distanceKm).toFixed(4)) : null,
      };
    })
    .filter((item) => item.costPerKm !== null)
    .sort((a, b) => (b.costPerKm ?? 0) - (a.costPerKm ?? 0))
    .slice(0, TOP_VEHICLES);

  const consumption = fuelRecords
    .map((record) => record.kmPerLiter)
    .filter(
      (value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0,
    );

  return {
    tenantId,
    period,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    fleetSize: vehicles.length,
    totalCost: Number(totalCost.toFixed(2)),
    costByCategory: [...costByCategoryMap.entries()]
      .map(([category, total]) => ({ category, total: Number(total.toFixed(2)) }))
      .sort((a, b) => b.total - a.total),
    topVehiclesByCostPerKm,
    fuel: {
      totalLiters: Number(fuelRecords.reduce((t, r) => t + r.liters, 0).toFixed(2)),
      totalCost: Number(fuelCost.toFixed(2)),
      averageKmPerLiter: consumption.length > 0 ? Number(mean(consumption).toFixed(4)) : null,
      kmPerLiterStdDev:
        consumption.length > 1 ? Number(standardDeviation(consumption).toFixed(4)) : null,
      recordCount: fuelRecords.length,
    },
    maintenance: {
      completed: serviceOrders.length,
      pending: pendingOrders,
      totalCost: Number(maintenanceCost.toFixed(2)),
    },
    fines: {
      count: fines.length,
      totalAmount: Number(fineAmount.toFixed(2)),
      totalPoints: fines.reduce((total, fine) => total + fine.points, 0),
    },
    highAnomalies: anomalies.map((anomaly) => ({
      kind: String(anomaly.kind),
      severity: String(anomaly.severity),
      message: anomaly.message,
      detectedAt: anomaly.detectedAt.toISOString(),
    })),
    comparison: {
      previousPeriod: priorPeriod,
      previousTotalCost: Number(previousTotalCost.toFixed(2)),
      totalCostChangeRate:
        previousTotalCost > 0
          ? Number(((totalCost - previousTotalCost) / previousTotalCost).toFixed(4))
          : null,
    },
  };
}

/** Serialização usada como user message do relatório. */
export async function buildMonthlyAggregatesContext(
  tenantId: string,
  period: string,
): Promise<string> {
  return JSON.stringify(await buildMonthlyAggregates(tenantId, period));
}
