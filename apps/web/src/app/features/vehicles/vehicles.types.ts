import type { FuelType } from '@frota-leve/shared/src/enums/fuel-type.enum';
import type { VehicleCategory } from '@frota-leve/shared/src/enums/vehicle-category.enum';
import type { VehicleStatus } from '@frota-leve/shared/src/enums/vehicle-status.enum';

export type VehicleDriver = {
  id: string;
  name: string;
  email: string;
};

export type VehicleListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type VehicleRecord = {
  id: string;
  tenantId: string;
  plate: string;
  renavam: string | null;
  chassis: string | null;
  brand: string;
  model: string;
  year: number;
  yearModel: number;
  color: string | null;
  fuelType: FuelType;
  category: VehicleCategory;
  status: VehicleStatus;
  currentMileage: number;
  averageConsumption: number | null;
  expectedConsumption: number | null;
  acquisitionDate: string | null;
  acquisitionValue: number | null;
  photos: string[] | null;
  notes: string | null;
  currentDriverId: string | null;
  createdAt: string;
  updatedAt: string;
  currentDriver: VehicleDriver | null;
};

export type VehicleListItem = VehicleRecord & {
  brandModel: string;
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
  createdAt: string;
};

export type VehicleDetail = VehicleRecord & {
  timeline: VehicleTimelineItem[];
};

export type VehicleListFilters = {
  status?: VehicleStatus | null;
  category?: VehicleCategory | null;
  fuelType?: FuelType | null;
  search?: string;
};

export type VehicleListResponse = {
  items: VehicleListItem[];
  hasNext: boolean;
  meta: VehicleListMeta;
};

export type VehicleStatsResponse = {
  total: number;
  byStatus: Record<VehicleStatus, number>;
  byCategory: Record<VehicleCategory, number>;
  byFuelType: Record<FuelType, number>;
  averageFleetAge: number;
  averageMileage: number;
};

export type VehicleImportError = {
  row: number;
  plate?: string;
  errors: string[];
};

export type VehicleImportPreviewItem = {
  row: number;
  plate: string;
  brand: string;
  model: string;
  year: number;
  yearModel: number;
  status: VehicleStatus;
  category: VehicleCategory;
  fuelType: FuelType;
  currentMileage: number;
};

export type VehicleImportPreviewResponse = {
  preview?: boolean;
  readyCount?: number;
  importedCount: number;
  errorCount: number;
  items: VehicleImportPreviewItem[];
  errors: VehicleImportError[];
};

export type VehicleImportResponse = {
  preview?: boolean;
  readyCount?: number;
  importedCount: number;
  errorCount: number;
  items: VehicleRecord[];
  errors: VehicleImportError[];
};

export type VehicleDeletionResponse = {
  deleted: true;
  mode: 'hard' | 'soft';
  vehicleId: string;
};

export type VehicleFormPayload = {
  plate: string;
  renavam?: string | null;
  chassis?: string | null;
  brand: string;
  model: string;
  year: number;
  yearModel: number;
  color?: string | null;
  fuelType: FuelType;
  category: VehicleCategory;
  status: VehicleStatus;
  currentMileage: number;
  expectedConsumption?: number | null;
  acquisitionDate?: string | null;
  acquisitionValue?: number | null;
  photos?: string[];
  notes?: string | null;
};
