import type { PlanType } from '@frota-leve/database';

export type IncidentActorContext = {
  tenantId: string;
  tenantPlan: PlanType;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

export type IncidentListResponse<T> = {
  items: T[];
  hasNext: boolean;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type IncidentVehicleInfo = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
};

export type IncidentDriverInfo = {
  id: string;
  name: string;
  cpf: string;
};

export type IncidentWithRelations = {
  id: string;
  tenantId: string;
  vehicleId: string;
  driverId: string | null;
  date: Date;
  location: string;
  type: string;
  description: string;
  thirdPartyInvolved: boolean;
  policeReport: boolean;
  insurerNotified: boolean;
  insuranceClaimNumber: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  status: string;
  photos: string[];
  documents: string[];
  downtime: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  vehicle: IncidentVehicleInfo;
  driver: IncidentDriverInfo | null;
};

export type IncidentDeletionResult = {
  deleted: true;
  mode: 'hard' | 'soft';
  incidentId: string;
};

export type IncidentStatsGranularity = 'day' | 'month';

export type IncidentStatsSummary = {
  total: number;
  totalEstimatedCost: number;
  totalActualCost: number;
  averageEstimatedCost: number;
  averageActualCost: number;
  totalDowntime: number;
  averageDowntime: number;
  dateFrom: Date | null;
  dateTo: Date | null;
};

export type IncidentStatsByStatus = {
  status: string;
  count: number;
  estimatedCost: number;
  actualCost: number;
  downtime: number;
};

export type IncidentStatsByType = {
  type: string;
  count: number;
  estimatedCost: number;
  actualCost: number;
  downtime: number;
};

export type IncidentStatsByPeriod = {
  period: string;
  label: string;
  count: number;
  actualCost: number;
  downtime: number;
};

export type IncidentStatsResponse = {
  summary: IncidentStatsSummary;
  byStatus: IncidentStatsByStatus[];
  byType: IncidentStatsByType[];
  byPeriod: IncidentStatsByPeriod[];
};
