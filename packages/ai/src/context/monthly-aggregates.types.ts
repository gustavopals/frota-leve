/** Agregados que alimentam o relatório mensal (TASK 3.5.1). */

export interface MonthlyCostByCategory {
  category: string;
  total: number;
}

export interface MonthlyVehicleCost {
  vehicleId: string;
  plate: string;
  totalCost: number;
  distanceKm: number;
  costPerKm: number | null;
}

export interface MonthlyFuelStats {
  totalLiters: number;
  totalCost: number;
  averageKmPerLiter: number | null;
  /** Desvio padrão amostral do km/l no período. */
  kmPerLiterStdDev: number | null;
  recordCount: number;
}

export interface MonthlyMaintenanceStats {
  completed: number;
  pending: number;
  totalCost: number;
}

export interface MonthlyFineStats {
  count: number;
  totalAmount: number;
  totalPoints: number;
}

export interface MonthlyAnomalySummary {
  kind: string;
  severity: string;
  message: string;
  detectedAt: string;
}

export interface MonthlyComparison {
  previousPeriod: string;
  previousTotalCost: number;
  /** Variação relativa vs. mês anterior. `null` quando não há base de comparação. */
  totalCostChangeRate: number | null;
}

export interface MonthlyReportData {
  tenantId: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  fleetSize: number;
  totalCost: number;
  costByCategory: MonthlyCostByCategory[];
  topVehiclesByCostPerKm: MonthlyVehicleCost[];
  fuel: MonthlyFuelStats;
  maintenance: MonthlyMaintenanceStats;
  fines: MonthlyFineStats;
  highAnomalies: MonthlyAnomalySummary[];
  comparison: MonthlyComparison;
}
