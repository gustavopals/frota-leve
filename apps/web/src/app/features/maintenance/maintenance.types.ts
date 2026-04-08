import type { MaintenanceType } from '@frota-leve/shared/src/enums/maintenance-type.enum';
import type { ServiceOrderStatus } from '@frota-leve/shared/src/enums/os-status.enum';
import type { VehicleStatus } from '@frota-leve/shared/src/enums/vehicle-status.enum';

export type { MaintenanceType } from '@frota-leve/shared/src/enums/maintenance-type.enum';
export type { ServiceOrderStatus } from '@frota-leve/shared/src/enums/os-status.enum';

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

export type MaintenanceVehicleListResponse = {
  items: MaintenanceVehicleOption[];
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

export type MaintenanceDriverOption = {
  id: string;
  name: string;
  cpf: string;
  label: string;
};

export type MaintenancePlanOption = {
  id: string;
  vehicleId: string;
  name: string;
  type: MaintenanceType;
  label: string;
  vehicleLabel: string;
  isActive: boolean;
};

export type MaintenancePlanActivityFilter = 'active' | 'inactive';

export type MaintenancePlanListFilters = {
  search?: string;
  vehicleId?: string;
  type?: MaintenanceType | null;
  activity?: MaintenancePlanActivityFilter | null;
};

export type MaintenancePlanVisualStatus = 'healthy' | 'upcoming' | 'overdue' | 'inactive';

export type MaintenanceStatsFilters = {
  vehicleId?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
};

export type MaintenanceReliabilityItem = {
  vehicle: MaintenancePlanVehicle;
  correctiveOrders: number;
  totalDowntimeHours: number;
  totalOperatingHours: number | null;
  mttrHours: number;
  mtbfHours: number | null;
  lastRepairStartedAt: string | null;
  lastRepairCompletedAt: string | null;
};

export type MaintenanceReliabilitySummary = {
  totalVehicles: number;
  totalCorrectiveOrders: number;
  vehiclesWithMtbf: number;
  averageMttrHours: number | null;
  averageMtbfHours: number | null;
  totalDowntimeHours: number;
  totalOperatingHours: number;
  dateFrom: string | null;
  dateTo: string | null;
};

export type MaintenanceCostGranularity = 'day' | 'month';

export type MaintenanceCostTypeSummary = {
  totalOrders: number;
  totalCost: number;
  laborCost: number;
  partsCost: number;
};

export type MaintenanceCostPeriodItem = {
  period: string;
  label: string;
  totalOrders: number;
  totalCost: number;
  laborCost: number;
  partsCost: number;
  preventiveCost: number;
  correctiveCost: number;
  predictiveCost: number;
};

export type MaintenanceCostVehicleItem = {
  vehicle: MaintenancePlanVehicle;
  totalOrders: number;
  totalCost: number;
  laborCost: number;
  partsCost: number;
  preventiveCost: number;
  correctiveCost: number;
  predictiveCost: number;
};

export type MaintenanceCostsSummary = {
  totalOrders: number;
  totalCost: number;
  laborCost: number;
  partsCost: number;
  averageOrderCost: number | null;
  preventiveCost: number;
  correctiveCost: number;
  predictiveCost: number;
  dateFrom: string | null;
  dateTo: string | null;
  granularity: MaintenanceCostGranularity;
};

export type MaintenanceCostsResponse = {
  summary: MaintenanceCostsSummary;
  byType: {
    preventive: MaintenanceCostTypeSummary;
    corrective: MaintenanceCostTypeSummary;
    predictive: MaintenanceCostTypeSummary;
  };
  byVehicle: MaintenanceCostVehicleItem[];
  byPeriod: MaintenanceCostPeriodItem[];
};

export type MaintenanceStatsResponse = {
  reliability: {
    items: MaintenanceReliabilityItem[];
    summary: MaintenanceReliabilitySummary;
  };
  costs: MaintenanceCostsResponse;
};

export type MaintenanceUserInfo = {
  id: string;
  name: string;
  email: string;
};

export type MaintenanceDriverInfo = {
  id: string;
  name: string;
  cpf: string;
};

export type MaintenancePlanInfo = {
  id: string;
  name: string;
  type: MaintenanceType;
};

export type ServiceOrderItem = {
  id: string;
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  partNumber: string | null;
};

export type ServiceOrderFormItemPayload = {
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  partNumber?: string | null;
};

export type ServiceOrderFormPayload = {
  vehicleId: string;
  driverId?: string | null;
  planId?: string | null;
  type: MaintenanceType;
  status: ServiceOrderStatus;
  description: string;
  workshop?: string | null;
  laborCost?: number | null;
  partsCost?: number | null;
  totalCost?: number | null;
  notes?: string | null;
  photos: string[];
  invoiceUrl?: string | null;
  items: ServiceOrderFormItemPayload[];
};

export type ServiceOrderRecord = {
  id: string;
  tenantId: string;
  vehicleId: string;
  driverId: string | null;
  planId: string | null;
  type: MaintenanceType;
  status: ServiceOrderStatus;
  description: string;
  workshop: string | null;
  startDate: string | null;
  endDate: string | null;
  totalCost: number;
  laborCost: number | null;
  partsCost: number | null;
  notes: string | null;
  photos: string[];
  invoiceUrl: string | null;
  approvedByUserId: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  vehicle: MaintenancePlanVehicle;
  driver: MaintenanceDriverInfo | null;
  plan: MaintenancePlanInfo | null;
  approvedByUser: MaintenanceUserInfo | null;
  createdByUser: MaintenanceUserInfo | null;
  items: ServiceOrderItem[];
};

export type ServiceOrderListResponse = {
  items: ServiceOrderRecord[];
  hasNext: boolean;
  meta: MaintenancePlanListMeta;
};

export type ServiceOrderListFilters = {
  vehicleId?: string;
  status?: ServiceOrderStatus | null;
  dateFrom?: string | null;
  dateTo?: string | null;
};
