export type DashboardAlertSeverity = 'high' | 'medium' | 'low';

export type DashboardAlertType =
  | 'maintenance_due'
  | 'documents_expiring'
  | 'driver_cnh_expiring'
  | 'pending_fine';

export interface DashboardVehicleSummary {
  total: number;
  active: number;
  maintenance: number;
  reserve: number;
  decommissioned: number;
  incident: number;
}

export interface DashboardDriverSummary {
  total: number;
  active: number;
  cnhExpiring: number;
}

export interface DashboardAlertItem {
  id: string;
  type: DashboardAlertType;
  severity: DashboardAlertSeverity;
  title: string;
  description: string;
  dueAt: string | null;
  link: string | null;
}

export interface DashboardAlertsSummary {
  maintenanceDue: number;
  documentsExpiring: number;
  pendingFines: number;
  cnhExpiring: number;
  totalPending: number;
  items: DashboardAlertItem[];
}

export interface DashboardCostBreakdown {
  fuel: number;
  maintenance: number;
  fines: number;
  other: number;
  total: number;
}

export interface DashboardMonthlyCostItem extends DashboardCostBreakdown {
  month: string;
}

export interface DashboardCostSummary {
  currentMonth: number;
  previousMonth: number;
  variation: number;
  breakdownCurrentMonth: DashboardCostBreakdown;
  breakdownPreviousMonth: DashboardCostBreakdown;
  monthlySeries: DashboardMonthlyCostItem[];
}

export interface DashboardRecentActivityItem {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  actorName: string | null;
  description: string;
  occurredAt: string;
  link: string | null;
}

export interface DashboardSummaryResponse {
  generatedAt: string;
  vehicles: DashboardVehicleSummary;
  drivers: DashboardDriverSummary;
  alerts: DashboardAlertsSummary;
  costs: DashboardCostSummary;
  recentActivity: DashboardRecentActivityItem[];
}
