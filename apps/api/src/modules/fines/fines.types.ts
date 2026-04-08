import type { PlanType } from '@frota-leve/database';

export type FineActorContext = {
  tenantId: string;
  tenantPlan: PlanType;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

export type FineListResponse<T> = {
  items: T[];
  hasNext: boolean;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type FineVehicleInfo = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
};

export type FineDriverInfo = {
  id: string;
  name: string;
  cpf: string;
};

export type FineWithRelations = {
  id: string;
  tenantId: string;
  vehicleId: string;
  driverId: string | null;
  date: Date;
  autoNumber: string;
  location: string;
  description: string;
  severity: string;
  points: number;
  amount: number;
  discountAmount: number | null;
  dueDate: Date;
  status: string;
  payrollDeduction: boolean;
  notes: string | null;
  fileUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  vehicle: FineVehicleInfo;
  driver: FineDriverInfo | null;
};

export type FineDeletionResult = {
  deleted: true;
  mode: 'hard' | 'soft';
  fineId: string;
};

export type FineStatsGranularity = 'day' | 'month';

export type FineStatsSummary = {
  total: number;
  totalAmount: number;
  totalDiscount: number;
  netAmount: number;
  totalPoints: number;
  dateFrom: Date | null;
  dateTo: Date | null;
};

export type FineStatsByStatus = {
  status: string;
  count: number;
  amount: number;
};

export type FineStatsBySeverity = {
  severity: string;
  count: number;
  amount: number;
  points: number;
};

export type FineStatsByDriver = {
  driverId: string | null;
  driverName: string | null;
  driverCpf: string | null;
  count: number;
  amount: number;
  points: number;
};

export type FineStatsByPeriod = {
  period: string;
  label: string;
  count: number;
  amount: number;
};

export type FineStatsResponse = {
  summary: FineStatsSummary;
  byStatus: FineStatsByStatus[];
  bySeverity: FineStatsBySeverity[];
  byDriver: FineStatsByDriver[];
  byPeriod: FineStatsByPeriod[];
};
