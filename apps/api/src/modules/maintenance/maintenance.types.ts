import type { PlanType, VehicleStatus } from '@frota-leve/database';

export type MaintenanceActorContext = {
  tenantId: string;
  tenantPlan: PlanType;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

export type MaintenancePlanListResponse<T> = {
  items: T[];
  hasNext: boolean;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type MaintenancePlanVehicleInfo = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  currentMileage: number;
  status: VehicleStatus;
};

export type MaintenancePlanDueReason = 'date' | 'mileage';

export type MaintenancePlanWithVehicle = {
  id: string;
  tenantId: string;
  vehicleId: string;
  name: string;
  type: string;
  intervalKm: number | null;
  intervalDays: number | null;
  lastExecutedAt: Date | null;
  lastExecutedMileage: number | null;
  nextDueAt: Date | null;
  nextDueMileage: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  isOverdue: boolean;
  dueReasons: MaintenancePlanDueReason[];
  vehicle: MaintenancePlanVehicleInfo;
};

export type MaintenancePlanDeletionResult = {
  deleted: true;
  mode: 'hard' | 'soft';
  maintenancePlanId: string;
};

export type MaintenanceAlertType = 'overdue' | 'upcoming';

export type MaintenanceAlertItem = {
  id: string;
  tenantId: string;
  vehicleId: string;
  name: string;
  type: string;
  alertType: MaintenanceAlertType;
  dueReasons: MaintenancePlanDueReason[];
  nextDueAt: Date | null;
  nextDueMileage: number | null;
  currentMileage: number;
  remainingDays: number | null;
  remainingKm: number | null;
  vehicle: MaintenancePlanVehicleInfo;
};

export type MaintenanceAlertsResponse = {
  items: MaintenanceAlertItem[];
  summary: {
    overdue: number;
    upcoming: number;
    total: number;
    daysAhead: number;
    kmAhead: number;
  };
};

export type MaintenanceReliabilityItem = {
  vehicle: MaintenancePlanVehicleInfo;
  correctiveOrders: number;
  totalDowntimeHours: number;
  totalOperatingHours: number | null;
  mttrHours: number;
  mtbfHours: number | null;
  lastRepairStartedAt: Date | null;
  lastRepairCompletedAt: Date | null;
};

export type MaintenanceReliabilitySummary = {
  totalVehicles: number;
  totalCorrectiveOrders: number;
  vehiclesWithMtbf: number;
  averageMttrHours: number | null;
  averageMtbfHours: number | null;
  totalDowntimeHours: number;
  totalOperatingHours: number;
  dateFrom: Date | null;
  dateTo: Date | null;
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
  vehicle: MaintenancePlanVehicleInfo;
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
  dateFrom: Date | null;
  dateTo: Date | null;
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

export type ServiceOrderListResponse<T> = {
  items: T[];
  hasNext: boolean;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
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
  type: string;
};

export type ServiceOrderItem = {
  id: string;
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  partNumber: string | null;
};

export type ServiceOrderWithRelations = {
  id: string;
  tenantId: string;
  vehicleId: string;
  driverId: string | null;
  planId: string | null;
  type: string;
  status: string;
  description: string;
  workshop: string | null;
  startDate: Date | null;
  endDate: Date | null;
  totalCost: number;
  laborCost: number | null;
  partsCost: number | null;
  notes: string | null;
  photos: string[];
  approvedByUserId: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  vehicle: MaintenancePlanVehicleInfo;
  driver: MaintenanceDriverInfo | null;
  plan: MaintenancePlanInfo | null;
  approvedByUser: MaintenanceUserInfo | null;
  createdByUser: MaintenanceUserInfo | null;
  items: ServiceOrderItem[];
};

export type ServiceOrderDeletionResult = {
  deleted: true;
  mode: 'hard' | 'soft';
  serviceOrderId: string;
};
