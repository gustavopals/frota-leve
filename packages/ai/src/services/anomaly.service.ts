import { AIAnomalyKind, AIAnomalySeverity } from '@frota-leve/database';
import type {
  AnomalyDetectionInput,
  AnomalyFinding,
  CostPerKmSeries,
  FineSample,
  FuelRecordSample,
  MaintenanceCostSample,
} from './anomaly.types';
import { linearRegression, mean, percentile, zScore } from './statistics';

// ─── Parametros das regras (TASK 3.4.1) ──────────────────────────────────────

const FUEL_WINDOW_DAYS = 30;
const FUEL_MIN_SAMPLE = 10;
const FUEL_Z_THRESHOLD = 2;

const MAINT_PERCENTILE = 90;
/** Grupos pequenos tornam o p90 instavel e geram falso positivo em frota enxuta. */
const MAINT_MIN_PEER_GROUP = 5;

const FINE_WINDOW_DAYS = 30;
const FINE_MIN_OCCURRENCES = 3;

const TREND_MIN_MONTHS = 4;
const TREND_MIN_SLOPE_RATIO = 0.05;
const TREND_MIN_R_SQUARED = 0.5;

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBefore(reference: Date, days: number): Date {
  return new Date(reference.getTime() - days * DAY_MS);
}

function isWithinWindow(date: Date, from: Date, to: Date): boolean {
  return date.getTime() >= from.getTime() && date.getTime() <= to.getTime();
}

function groupBy<T, K extends string>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();

  for (const item of items) {
    const key = keyOf(item);
    const bucket = groups.get(key);

    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return groups;
}

// ─── Regra 1: desvio de consumo (km/l) ───────────────────────────────────────

/**
 * Compara o km/l de cada abastecimento com a distribuicao dos ultimos 30 dias do
 * proprio veiculo. Exige amostra minima para o z-score significar alguma coisa.
 *
 * A anomalia é emitida por veiculo (nao por abastecimento) para que a dedupe por
 * `tenantId+kind+entityId` agrupe os desvios em um alerta aberto por veiculo,
 * em vez de criar um alerta novo a cada reabastecimento fora da curva.
 */
export function detectFuelDeviation(
  records: FuelRecordSample[],
  referenceDate: Date,
): AnomalyFinding[] {
  const windowStart = daysBefore(referenceDate, FUEL_WINDOW_DAYS);
  const inWindow = records.filter(
    (record): record is FuelRecordSample & { kmPerLiter: number } =>
      record.kmPerLiter !== null &&
      Number.isFinite(record.kmPerLiter) &&
      record.kmPerLiter > 0 &&
      isWithinWindow(record.date, windowStart, referenceDate),
  );

  const findings: AnomalyFinding[] = [];

  for (const [vehicleId, vehicleRecords] of groupBy(inWindow, (record) => record.vehicleId)) {
    if (vehicleRecords.length < FUEL_MIN_SAMPLE) {
      continue;
    }

    const consumption = vehicleRecords.map((record) => record.kmPerLiter);
    const outliers = vehicleRecords
      .map((record) => ({
        record,
        z: zScore(record.kmPerLiter, consumption),
      }))
      .filter((item) => Math.abs(item.z) > FUEL_Z_THRESHOLD);

    if (outliers.length === 0) {
      continue;
    }

    const worst = outliers.reduce((current, item) =>
      Math.abs(item.z) > Math.abs(current.z) ? item : current,
    );
    const absoluteZ = Math.abs(worst.z);

    findings.push({
      kind: AIAnomalyKind.FUEL_DEVIATION,
      severity: absoluteZ >= 3 ? AIAnomalySeverity.HIGH : AIAnomalySeverity.MED,
      entityType: 'vehicle',
      entityId: vehicleId,
      score: Number(absoluteZ.toFixed(4)),
      evidence: {
        windowDays: FUEL_WINDOW_DAYS,
        sampleSize: vehicleRecords.length,
        averageKmPerLiter: Number(mean(consumption).toFixed(4)),
        worstRecordId: worst.record.id,
        worstKmPerLiter: worst.record.kmPerLiter,
        worstZScore: Number(worst.z.toFixed(4)),
        outlierRecordIds: outliers.map((item) => item.record.id),
      },
    });
  }

  return findings;
}

// ─── Regra 2: custo de manutencao acima do p90 dos pares ─────────────────────

/**
 * Compara o custo acumulado do veiculo com o percentil 90 dos veiculos de mesma
 * categoria e mesmo ano de fabricacao dentro do tenant.
 */
export function detectMaintenanceCost(samples: MaintenanceCostSample[]): AnomalyFinding[] {
  const findings: AnomalyFinding[] = [];
  const peerGroups = groupBy(samples, (sample) => `${sample.category}#${sample.year}`);

  for (const [peerKey, peers] of peerGroups) {
    if (peers.length < MAINT_MIN_PEER_GROUP) {
      continue;
    }

    const costs = peers.map((peer) => peer.totalCost);
    const threshold = percentile(costs, MAINT_PERCENTILE);

    if (threshold <= 0) {
      continue;
    }

    for (const peer of peers) {
      if (peer.totalCost <= threshold) {
        continue;
      }

      const ratio = peer.totalCost / threshold;

      findings.push({
        kind: AIAnomalyKind.MAINT_COST,
        severity: ratio >= 1.5 ? AIAnomalySeverity.HIGH : AIAnomalySeverity.MED,
        entityType: 'vehicle',
        entityId: peer.vehicleId,
        score: Number(ratio.toFixed(4)),
        evidence: {
          peerGroup: peerKey,
          peerGroupSize: peers.length,
          totalCost: Number(peer.totalCost.toFixed(2)),
          peerPercentile90: Number(threshold.toFixed(2)),
          peerMedian: Number(percentile(costs, 50).toFixed(2)),
          ratioOverPercentile90: Number(ratio.toFixed(4)),
        },
      });
    }
  }

  return findings;
}

// ─── Regra 3: reincidencia de multas ─────────────────────────────────────────

/**
 * Dois gatilhos independentes em 30 dias:
 * - mesmo motorista com >= 3 multas;
 * - mesmo veiculo autuado >= 3 vezes no mesmo local.
 *
 * O segundo gatilho é a leitura possivel de "mesmo trecho": o schema nao modela
 * trecho como entidade, entao o par (veiculo, local) é o proxy mais proximo que
 * ainda dedupe de forma estavel por `entityId`.
 */
export function detectFinePattern(fines: FineSample[], referenceDate: Date): AnomalyFinding[] {
  const windowStart = daysBefore(referenceDate, FINE_WINDOW_DAYS);
  const inWindow = fines.filter((fine) => isWithinWindow(fine.date, windowStart, referenceDate));
  const findings: AnomalyFinding[] = [];

  const byDriver = groupBy(
    inWindow.filter((fine): fine is FineSample & { driverId: string } => fine.driverId !== null),
    (fine) => fine.driverId,
  );

  for (const [driverId, driverFines] of byDriver) {
    if (driverFines.length < FINE_MIN_OCCURRENCES) {
      continue;
    }

    findings.push({
      kind: AIAnomalyKind.FINE_PATTERN,
      severity: driverFines.length >= 5 ? AIAnomalySeverity.HIGH : AIAnomalySeverity.MED,
      entityType: 'driver',
      entityId: driverId,
      score: driverFines.length,
      evidence: {
        trigger: 'same_driver',
        windowDays: FINE_WINDOW_DAYS,
        fineCount: driverFines.length,
        fineIds: driverFines.map((fine) => fine.id),
        vehicleIds: [...new Set(driverFines.map((fine) => fine.vehicleId))],
      },
    });
  }

  const byVehicleLocation = groupBy(
    inWindow,
    (fine) => `${fine.vehicleId}#${fine.location.trim().toLowerCase()}`,
  );

  for (const [, locationFines] of byVehicleLocation) {
    if (locationFines.length < FINE_MIN_OCCURRENCES) {
      continue;
    }

    const first = locationFines[0];

    if (!first) {
      continue;
    }

    findings.push({
      kind: AIAnomalyKind.FINE_PATTERN,
      severity: locationFines.length >= 5 ? AIAnomalySeverity.HIGH : AIAnomalySeverity.MED,
      entityType: 'vehicle',
      entityId: first.vehicleId,
      score: locationFines.length,
      evidence: {
        trigger: 'same_location',
        windowDays: FINE_WINDOW_DAYS,
        location: first.location,
        fineCount: locationFines.length,
        fineIds: locationFines.map((fine) => fine.id),
      },
    });
  }

  return findings;
}

// ─── Regra 4: tendencia de custo por km ──────────────────────────────────────

/**
 * Regressao linear do custo/km nos ultimos meses. O slope é normalizado pela media
 * da serie para virar "% ao mes", e so vira anomalia com ajuste minimo (R²).
 */
export function detectCostPerKmTrend(series: CostPerKmSeries[]): AnomalyFinding[] {
  const findings: AnomalyFinding[] = [];

  for (const vehicleSeries of series) {
    const points = vehicleSeries.points.filter((point) => Number.isFinite(point.costPerKm));

    if (points.length < TREND_MIN_MONTHS) {
      continue;
    }

    const values = points.map((point) => point.costPerKm);
    const averageCostPerKm = mean(values);

    if (averageCostPerKm <= 0) {
      continue;
    }

    const regression = linearRegression(
      points.map((point) => ({ x: point.monthIndex, y: point.costPerKm })),
    );
    const slopeRatio = regression.slope / averageCostPerKm;

    if (slopeRatio <= TREND_MIN_SLOPE_RATIO || regression.rSquared <= TREND_MIN_R_SQUARED) {
      continue;
    }

    findings.push({
      kind: AIAnomalyKind.COST_PER_KM_TREND,
      severity: slopeRatio >= 0.1 ? AIAnomalySeverity.HIGH : AIAnomalySeverity.MED,
      entityType: 'vehicle',
      entityId: vehicleSeries.vehicleId,
      score: Number(slopeRatio.toFixed(4)),
      evidence: {
        months: points.length,
        monthlyGrowthRate: Number(slopeRatio.toFixed(4)),
        slope: Number(regression.slope.toFixed(6)),
        rSquared: Number(regression.rSquared.toFixed(4)),
        averageCostPerKm: Number(averageCostPerKm.toFixed(4)),
        firstCostPerKm: Number((values.at(0) ?? 0).toFixed(4)),
        lastCostPerKm: Number((values.at(-1) ?? 0).toFixed(4)),
      },
    });
  }

  return findings;
}

// ─── Orquestrador ────────────────────────────────────────────────────────────

export class AnomalyService {
  /**
   * Roda as quatro regras deterministicas sobre dados ja carregados.
   *
   * Nao chama IA e nao toca em banco: recebe amostras e devolve achados, para que
   * a deteccao continue funcionando com `AI_ENABLED=false` (criterio de aceite da
   * TASK 3.4) e possa ser testada com fixtures sinteticas.
   */
  detect(input: AnomalyDetectionInput): AnomalyFinding[] {
    return [
      ...detectFuelDeviation(input.fuelRecords, input.referenceDate),
      ...detectMaintenanceCost(input.maintenanceCosts),
      ...detectFinePattern(input.fines, input.referenceDate),
      ...detectCostPerKmTrend(input.costPerKmSeries),
    ];
  }
}

export const anomalyService = new AnomalyService();
