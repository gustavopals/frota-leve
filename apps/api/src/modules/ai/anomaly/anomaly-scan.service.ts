import { AIAnomalyKind, AIAnomalyStatus, type Prisma, VehicleStatus } from '@frota-leve/database';
import { anomalyService } from '@frota-leve/ai';
import type { AnomalyDetectionInput, AnomalyFinding, CostPerKmSeries } from '@frota-leve/ai';
import { PLAN_LIMITS } from '@frota-leve/shared';
import type { PlanType as SharedPlanType } from '@frota-leve/shared';
import { prisma } from '../../../config/database';

const DAY_MS = 24 * 60 * 60 * 1000;
const FUEL_WINDOW_DAYS = 30;
const FINE_WINDOW_DAYS = 30;
const MAINTENANCE_WINDOW_DAYS = 90;
const TREND_WINDOW_MONTHS = 6;

export interface AnomalyScanTenantResult {
  tenantId: string;
  detected: number;
  created: number;
  refreshed: number;
}

function daysBefore(reference: Date, days: number): Date {
  return new Date(reference.getTime() - days * DAY_MS);
}

/** Inicio do mes UTC deslocado `monthsBack` meses a partir de `reference`. */
function startOfMonthUtc(reference: Date, monthsBack: number): Date {
  return new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() - monthsBack, 1, 0, 0, 0, 0),
  );
}

/** Indice 0..N-1 do mes de `date` dentro da janela que comeca em `windowStart`. */
function monthIndex(windowStart: Date, date: Date): number {
  return (
    (date.getUTCFullYear() - windowStart.getUTCFullYear()) * 12 +
    (date.getUTCMonth() - windowStart.getUTCMonth())
  );
}

/**
 * Texto determinístico usado enquanto a explicação por IA (TASK 3.4.3) não roda.
 * Mantém a anomalia utilizável com `AI_ENABLED=false` — a IA só reescreve este campo.
 */
export function buildFallbackMessage(finding: AnomalyFinding): string {
  switch (finding.kind) {
    case AIAnomalyKind.FUEL_DEVIATION:
      return `Consumo fora do padrão: ${finding.evidence['outlierRecordIds'] instanceof Array ? finding.evidence['outlierRecordIds'].length : 1} abastecimento(s) desviando da média de ${String(finding.evidence['averageKmPerLiter'])} km/l nos últimos 30 dias.`;
    case AIAnomalyKind.MAINT_COST:
      return `Custo de manutenção de R$ ${String(finding.evidence['totalCost'])} nos últimos 90 dias, acima do percentil 90 (R$ ${String(finding.evidence['peerPercentile90'])}) dos veículos semelhantes.`;
    case AIAnomalyKind.FINE_PATTERN:
      return finding.evidence['trigger'] === 'same_driver'
        ? `Motorista com ${String(finding.evidence['fineCount'])} multas nos últimos 30 dias.`
        : `Veículo autuado ${String(finding.evidence['fineCount'])} vezes em "${String(finding.evidence['location'])}" nos últimos 30 dias.`;
    case AIAnomalyKind.COST_PER_KM_TREND: {
      const growth = Number(finding.evidence['monthlyGrowthRate'] ?? 0) * 100;
      return `Custo por km subindo ${growth.toFixed(1)}% ao mês nos últimos ${String(finding.evidence['months'])} meses.`;
    }
    default:
      return 'Anomalia detectada pelas regras determinísticas.';
  }
}

/**
 * Carrega as amostras necessárias para as quatro regras, sempre escopadas por tenant.
 */
export async function loadDetectionInput(
  tenantId: string,
  referenceDate: Date,
): Promise<AnomalyDetectionInput> {
  const trendWindowStart = startOfMonthUtc(referenceDate, TREND_WINDOW_MONTHS - 1);

  const [fuelWindowRecords, trendFuelRecords, fines, vehicles, maintenanceByVehicle, trendOrders] =
    await Promise.all([
      prisma.fuelRecord.findMany({
        where: {
          tenantId,
          date: { gte: daysBefore(referenceDate, FUEL_WINDOW_DAYS), lte: referenceDate },
        },
        select: { id: true, vehicleId: true, date: true, kmPerLiter: true },
      }),
      prisma.fuelRecord.findMany({
        where: { tenantId, date: { gte: trendWindowStart, lte: referenceDate } },
        select: { vehicleId: true, date: true, mileage: true, totalCost: true },
      }),
      prisma.fine.findMany({
        where: {
          tenantId,
          date: { gte: daysBefore(referenceDate, FINE_WINDOW_DAYS), lte: referenceDate },
        },
        select: { id: true, vehicleId: true, driverId: true, location: true, date: true },
      }),
      prisma.vehicle.findMany({
        // Veiculos baixados nao entram no grupo de comparacao do p90.
        where: { tenantId, status: { not: VehicleStatus.DECOMMISSIONED } },
        select: { id: true, category: true, year: true },
      }),
      prisma.serviceOrder.groupBy({
        by: ['vehicleId'],
        where: {
          tenantId,
          endDate: { gte: daysBefore(referenceDate, MAINTENANCE_WINDOW_DAYS), lte: referenceDate },
        },
        _sum: { totalCost: true },
      }),
      prisma.serviceOrder.findMany({
        where: { tenantId, endDate: { gte: trendWindowStart, lte: referenceDate } },
        select: { vehicleId: true, endDate: true, totalCost: true },
      }),
    ]);

  const costByVehicle = new Map(
    maintenanceByVehicle.map((row) => [row.vehicleId, row._sum.totalCost ?? 0]),
  );

  // Veiculos sem manutencao entram com custo zero: sao parte legitima da
  // distribuicao e sem eles o p90 do grupo fica artificialmente alto.
  const maintenanceCosts = vehicles.map((vehicle) => ({
    vehicleId: vehicle.id,
    category: String(vehicle.category),
    year: vehicle.year,
    totalCost: costByVehicle.get(vehicle.id) ?? 0,
  }));

  return {
    referenceDate,
    fuelRecords: fuelWindowRecords,
    fines,
    maintenanceCosts,
    costPerKmSeries: buildCostPerKmSeries(trendFuelRecords, trendOrders, trendWindowStart),
  };
}

/**
 * Monta a série mensal de custo/km por veículo.
 *
 * A quilometragem rodada no mês vem da variação do odômetro registrada nos
 * abastecimentos — é o único sinal contínuo disponível no schema. Meses sem
 * deslocamento medido são descartados em vez de virarem custo/km infinito.
 */
export function buildCostPerKmSeries(
  fuelRecords: Array<{ vehicleId: string; date: Date; mileage: number; totalCost: number }>,
  serviceOrders: Array<{ vehicleId: string; endDate: Date | null; totalCost: number }>,
  windowStart: Date,
): CostPerKmSeries[] {
  type MonthBucket = { cost: number; minMileage: number; maxMileage: number; hasMileage: boolean };
  const byVehicle = new Map<string, Map<number, MonthBucket>>();

  function bucketFor(vehicleId: string, index: number): MonthBucket {
    let months = byVehicle.get(vehicleId);

    if (!months) {
      months = new Map<number, MonthBucket>();
      byVehicle.set(vehicleId, months);
    }

    let bucket = months.get(index);

    if (!bucket) {
      bucket = { cost: 0, minMileage: Infinity, maxMileage: -Infinity, hasMileage: false };
      months.set(index, bucket);
    }

    return bucket;
  }

  for (const record of fuelRecords) {
    const index = monthIndex(windowStart, record.date);

    if (index < 0) {
      continue;
    }

    const bucket = bucketFor(record.vehicleId, index);
    bucket.cost += record.totalCost;
    bucket.minMileage = Math.min(bucket.minMileage, record.mileage);
    bucket.maxMileage = Math.max(bucket.maxMileage, record.mileage);
    bucket.hasMileage = true;
  }

  for (const order of serviceOrders) {
    if (!order.endDate) {
      continue;
    }

    const index = monthIndex(windowStart, order.endDate);

    if (index < 0) {
      continue;
    }

    bucketFor(order.vehicleId, index).cost += order.totalCost;
  }

  const series: CostPerKmSeries[] = [];

  for (const [vehicleId, months] of byVehicle) {
    const points = [...months.entries()]
      .sort(([a], [b]) => a - b)
      .flatMap(([index, bucket]) => {
        if (!bucket.hasMileage) {
          return [];
        }

        const distance = bucket.maxMileage - bucket.minMileage;

        if (distance <= 0) {
          return [];
        }

        return [{ monthIndex: index, costPerKm: bucket.cost / distance }];
      });

    if (points.length > 0) {
      series.push({ vehicleId, points });
    }
  }

  return series;
}

export class AnomalyScanService {
  /**
   * Roda a detecção para um tenant e persiste os achados.
   *
   * Dedupe conforme TASK 3.4.2: um achado que já tenha uma anomalia OPEN com o
   * mesmo `tenantId+kind+entityId` atualiza o registro existente em vez de criar
   * outro. Anomalias já tratadas (ACK/DISMISSED) não bloqueiam um alerta novo.
   */
  async scanTenant(
    tenantId: string,
    referenceDate: Date = new Date(),
  ): Promise<AnomalyScanTenantResult> {
    const input = await loadDetectionInput(tenantId, referenceDate);
    const findings = anomalyService.detect(input);

    let created = 0;
    let refreshed = 0;

    for (const finding of findings) {
      const existing = await prisma.aIAnomaly.findFirst({
        where: {
          tenantId,
          kind: finding.kind,
          entityId: finding.entityId,
          status: AIAnomalyStatus.OPEN,
        },
        select: { id: true },
      });

      const evidence = finding.evidence as Prisma.InputJsonValue;

      if (existing) {
        await prisma.aIAnomaly.update({
          where: { id: existing.id },
          data: {
            severity: finding.severity,
            score: finding.score,
            evidence,
            detectedAt: referenceDate,
          },
        });
        refreshed += 1;
        continue;
      }

      await prisma.aIAnomaly.create({
        data: {
          tenantId,
          kind: finding.kind,
          severity: finding.severity,
          entityType: finding.entityType,
          entityId: finding.entityId,
          score: finding.score,
          evidence,
          message: buildFallbackMessage(finding),
          status: AIAnomalyStatus.OPEN,
          detectedAt: referenceDate,
        },
      });
      created += 1;
    }

    return { tenantId, detected: findings.length, created, refreshed };
  }

  /** Tenants cujo plano habilita IA — os únicos varridos pelo job (TASK 3.4.2). */
  async listScannableTenantIds(): Promise<string[]> {
    const tenants = await prisma.tenant.findMany({ select: { id: true, plan: true } });

    return tenants
      .filter((tenant) => PLAN_LIMITS[tenant.plan as SharedPlanType]?.hasAI)
      .map((tenant) => tenant.id);
  }

  async scanAllTenants(referenceDate: Date = new Date()): Promise<AnomalyScanTenantResult[]> {
    const tenantIds = await this.listScannableTenantIds();
    const results: AnomalyScanTenantResult[] = [];

    for (const tenantId of tenantIds) {
      results.push(await this.scanTenant(tenantId, referenceDate));
    }

    return results;
  }
}

export const anomalyScanService = new AnomalyScanService();
