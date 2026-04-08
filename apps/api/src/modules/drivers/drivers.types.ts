import type { PlanType } from '@frota-leve/database';

export type DriverActorContext = {
  tenantId: string;
  tenantPlan: PlanType;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

export type DriverListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type DriverListResponse<TDriver> = {
  items: TDriver[];
  hasNext: boolean;
  meta: DriverListMeta;
};

export type DriverHistoryVehicle = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  status: string;
};

export type DriverHistoryEntry = {
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

export type DriverHistory = {
  driverId: string;
  assignedVehicles: DriverHistoryVehicle[];
  auditLog: DriverHistoryEntry[];
};

export type DriverDeletionResult = {
  deleted: true;
  mode: 'hard' | 'soft';
  driverId: string;
};

export type DriverImportError = {
  row: number;
  cpf?: string;
  errors: string[];
};

export type DriverImportPreviewItem = {
  row: number;
  name: string;
  cpf: string;
  phone?: string;
  department?: string;
  cnhCategory?: string;
  cnhExpiration?: Date;
};

export type DriverImportResult<TDriver> = {
  preview?: boolean;
  readyCount?: number;
  importedCount: number;
  errorCount: number;
  items: TDriver[];
  errors: DriverImportError[];
};
