import type { AIAnomalyKind, AIAnomalySeverity } from '@frota-leve/database';

/**
 * Achado de anomalia produzido pelas regras deterministicas.
 * Mapeia 1:1 para os campos de `AIAnomaly` que a deteccao consegue preencher —
 * `message` fica de fora porque é o unico campo gerado por IA (TASK 3.4.3).
 */
export interface AnomalyFinding {
  kind: AIAnomalyKind;
  severity: AIAnomalySeverity;
  entityType: 'vehicle' | 'driver' | 'fuel_record';
  entityId: string;
  /** Intensidade normalizada do desvio. Quanto maior, mais grave. */
  score: number;
  /** Numeros que sustentam o achado — persistidos em `AIAnomaly.evidence`. */
  evidence: Record<string, unknown>;
}

export interface FuelRecordSample {
  id: string;
  vehicleId: string;
  date: Date;
  kmPerLiter: number | null;
}

export interface MaintenanceCostSample {
  vehicleId: string;
  category: string;
  /** Ano de fabricacao — usado para agrupar veiculos de idade parecida. */
  year: number;
  /** Custo acumulado de ordens de servico na janela analisada. */
  totalCost: number;
}

export interface FineSample {
  id: string;
  vehicleId: string;
  driverId: string | null;
  location: string;
  date: Date;
}

export interface CostPerKmPoint {
  /** Indice do mes na serie (0 = mais antigo). */
  monthIndex: number;
  costPerKm: number;
}

export interface CostPerKmSeries {
  vehicleId: string;
  points: CostPerKmPoint[];
}

export interface AnomalyDetectionInput {
  fuelRecords: FuelRecordSample[];
  maintenanceCosts: MaintenanceCostSample[];
  fines: FineSample[];
  costPerKmSeries: CostPerKmSeries[];
  /** Fim da janela analisada. Injetado para tornar a deteccao deterministica em teste. */
  referenceDate: Date;
}
