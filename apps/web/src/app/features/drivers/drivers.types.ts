import type { UserRole } from '@frota-leve/shared/src/enums/user-role.enum';
import type { VehicleStatus } from '@frota-leve/shared/src/enums/vehicle-status.enum';
import type { CnhCategory } from '@frota-leve/shared/src/dtos/driver.dto';

export type DriverUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

export type DriverRecord = {
  id: string;
  tenantId: string;
  name: string;
  cpf: string;
  phone: string | null;
  email: string | null;
  birthDate: string | null;
  cnhNumber: string | null;
  cnhCategory: CnhCategory | null;
  cnhExpiration: string | null;
  cnhPoints: number | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  department: string | null;
  isActive: boolean;
  photoUrl: string | null;
  hireDate: string | null;
  score: number | null;
  notes: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
  cnhExpiring: boolean;
  user: DriverUser | null;
};

export type DriverListItem = DriverRecord;

export type DriverHistoryVehicle = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  status: VehicleStatus | string;
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
  createdAt: string;
};

export type DriverHistory = {
  driverId: string;
  assignedVehicles: DriverHistoryVehicle[];
  auditLog: DriverHistoryEntry[];
};

export type DriverDetail = DriverRecord & {
  history: DriverHistory;
};

export type DriverListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type DriverListFilters = {
  search?: string;
  department?: string;
  isActive?: boolean | null;
  cnhExpiring?: boolean | null;
};

export type DriverListResponse = {
  items: DriverListItem[];
  hasNext: boolean;
  meta: DriverListMeta;
};

export type DriverDeletionResponse = {
  deleted: true;
  mode: 'hard' | 'soft';
  driverId: string;
};

export type DriverFormPayload = {
  name: string;
  cpf: string;
  phone?: string | null;
  email?: string | null;
  birthDate?: string | null;
  cnhNumber?: string | null;
  cnhCategory?: CnhCategory | null;
  cnhExpiration?: string | null;
  cnhPoints?: number | null;
  emergencyContact?: string | null;
  emergencyPhone?: string | null;
  department?: string | null;
  isActive: boolean;
  photoUrl?: string | null;
  hireDate?: string | null;
  score?: number | null;
  notes?: string | null;
  userId?: string | null;
};

export type DriverVehicleOption = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  status: VehicleStatus;
};

export type DriverVehicleListResponse = {
  items: DriverVehicleOption[];
};
