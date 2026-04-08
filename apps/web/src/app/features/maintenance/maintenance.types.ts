import type { MaintenanceType } from '@frota-leve/shared/src/enums/maintenance-type.enum';
import type { VehicleStatus } from '@frota-leve/shared/src/enums/vehicle-status.enum';

export type { MaintenanceType } from '@frota-leve/shared/src/enums/maintenance-type.enum';

export type MaintenancePlanDueReason = 'date' | 'mileage';

export type MaintenancePlanVehicle = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  currentMileage: number;
  status: VehicleStatus;
};

export type MaintenancePlanRecord = {
  id: string;
  tenantId: string;
  vehicleId: string;
  name: string;
  type: MaintenanceType;
  intervalKm: number | null;
  intervalDays: number | null;
  lastExecutedAt: string | null;
  lastExecutedMileage: number | null;
  nextDueAt: string | null;
  nextDueMileage: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
  dueReasons: MaintenancePlanDueReason[];
  vehicle: MaintenancePlanVehicle;
};

export type MaintenancePlanListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type MaintenancePlanListResponse = {
  items: MaintenancePlanRecord[];
  hasNext: boolean;
  meta: MaintenancePlanListMeta;
};

export type MaintenanceVehicleOption = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  currentMileage: number;
  status: VehicleStatus;
};

export type MaintenancePlanActivityFilter = 'active' | 'inactive';

export type MaintenancePlanListFilters = {
  search?: string;
  vehicleId?: string;
  type?: MaintenanceType | null;
  activity?: MaintenancePlanActivityFilter | null;
};

export type MaintenancePlanVisualStatus = 'healthy' | 'upcoming' | 'overdue' | 'inactive';
