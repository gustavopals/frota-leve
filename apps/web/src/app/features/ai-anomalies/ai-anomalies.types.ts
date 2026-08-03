export type AnomalyKind =
  'FUEL_DEVIATION' | 'MAINT_COST' | 'FINE_PATTERN' | 'COST_PER_KM_TREND' | 'OTHER';

export type AnomalySeverity = 'LOW' | 'MED' | 'HIGH';

export type AnomalyStatus = 'OPEN' | 'ACK' | 'DISMISSED';

export interface AnomalyRecord {
  id: string;
  tenantId: string;
  kind: AnomalyKind;
  severity: AnomalySeverity;
  entityType: string;
  entityId: string;
  score: number;
  evidence: Record<string, unknown>;
  message: string;
  status: AnomalyStatus;
  detectedAt: string;
  acknowledgedAt: string | null;
  acknowledgedById: string | null;
}

export interface AnomalyListFilters {
  status?: AnomalyStatus;
  kind?: AnomalyKind;
  severity?: AnomalySeverity;
  page?: number;
  limit?: number;
}

export interface AnomalyListResponse {
  success: true;
  data: AnomalyRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface VehicleAiAnalysis {
  vehicleId: string;
  healthScore: number;
  openAnomalies: AnomalyRecord[];
}
