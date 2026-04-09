import type { FineSeverity } from '@frota-leve/shared/src/enums/fine-severity.enum';
import type { FineStatus } from '@frota-leve/shared/src/enums/fine-status.enum';

export type { FineSeverity } from '@frota-leve/shared/src/enums/fine-severity.enum';
export type { FineStatus } from '@frota-leve/shared/src/enums/fine-status.enum';

export type FineVehicle = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
};

export type FineDriver = {
  id: string;
  name: string;
  cpf: string;
};

export type FineRecord = {
  id: string;
  tenantId: string;
  vehicleId: string;
  driverId: string | null;
  date: string;
  autoNumber: string;
  location: string;
  description: string;
  severity: FineSeverity;
  points: number;
  amount: number;
  discountAmount: number | null;
  dueDate: string;
  status: FineStatus;
  payrollDeduction: boolean;
  notes: string | null;
  fileUrl: string | null;
  createdAt: string;
  updatedAt: string;
  vehicle: FineVehicle;
  driver: FineDriver | null;
};

export type FineListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type FineListResponse = {
  items: FineRecord[];
  hasNext: boolean;
  meta: FineListMeta;
};

export type FineListFilters = {
  vehicleId?: string;
  driverId?: string;
  status?: FineStatus | null;
  severity?: FineSeverity | null;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type FineWorkflowPayload = {
  vehicleId: string;
  driverId?: string | null;
  date: string;
  autoNumber: string;
  location: string;
  description: string;
  severity: FineSeverity;
  points: number;
  amount: number;
  discountAmount?: number | null;
  dueDate: string;
  status: FineStatus;
  payrollDeduction: boolean;
  notes?: string | null;
  fileUrl?: string | null;
};

export type FineImportResult = {
  total: number;
  imported: number;
  failed: number;
  errors: { row: number; message: string }[];
};

export type FineVehicleOption = {
  id: string;
  label: string;
  plate: string;
  brand: string;
  model: string;
};

export type FineDriverOption = {
  id: string;
  label: string;
  name: string;
  cpf: string;
};

export type FineStatsFilters = {
  dateFrom?: string;
  dateTo?: string;
  granularity?: 'day' | 'month';
};

export type FineStatsSummary = {
  total: number;
  totalAmount: number;
  totalDiscount: number;
  netAmount: number;
  totalPoints: number;
  dateFrom: string | null;
  dateTo: string | null;
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
