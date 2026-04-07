import type { FuelType, PlanType, VehicleCategory, VehicleStatus } from '@frota-leve/database';

export type VehicleActorContext = {
  tenantId: string;
  tenantPlan: PlanType;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

export type VehicleListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type VehicleListResponse<TVehicle> = {
  items: TVehicle[];
  meta: VehicleListMeta;
};

export type VehicleTimelineItem = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  userId: string | null;
  changes: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

export type VehicleImportError = {
  row: number;
  plate?: string;
  errors: string[];
};

export type VehicleImportResult<TVehicle> = {
  importedCount: number;
  errorCount: number;
  items: TVehicle[];
  errors: VehicleImportError[];
};

export type VehicleDeletionResult = {
  deleted: true;
  mode: 'hard' | 'soft';
  vehicleId: string;
};

export type VehicleStatsResponse = {
  total: number;
  byStatus: Record<VehicleStatus, number>;
  byCategory: Record<VehicleCategory, number>;
  averageFleetAge: number;
  averageMileage: number;
  byFuelType: Record<FuelType, number>;
};
