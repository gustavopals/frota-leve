import type { FuelType } from '@frota-leve/shared/src/enums/fuel-type.enum';

export type { FuelType } from '@frota-leve/shared/src/enums/fuel-type.enum';

export type FuelRecordVehicle = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
};

export type FuelRecordDriver = {
  id: string;
  name: string;
  cpf: string;
};

export type FuelVehicleOption = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  fuelType: FuelType;
  currentMileage: number;
  averageConsumption: number | null;
};

export type FuelDriverOption = {
  id: string;
  name: string;
  cpf: string;
};

export type FuelRecord = {
  id: string;
  tenantId: string;
  vehicleId: string;
  driverId: string | null;
  date: string;
  mileage: number;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  fuelType: FuelType;
  fullTank: boolean;
  gasStation: string | null;
  notes: string | null;
  receiptUrl: string | null;
  kmPerLiter: number | null;
  anomaly: boolean;
  anomalyReason: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  vehicle: FuelRecordVehicle;
  driver: FuelRecordDriver | null;
};

export type FuelRecordListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type FuelRecordListResponse = {
  items: FuelRecord[];
  hasNext: boolean;
  meta: FuelRecordListMeta;
};

export type FuelRecordStatsResponse = {
  totalRecords: number;
  totalCost: number;
  totalLiters: number;
  averageKmPerLiter: number | null;
  averagePricePerLiter: number | null;
  costPerKm: number | null;
  anomalyCount: number;
};

export type FuelRecordRankingItem = {
  vehicleId: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  averageKmPerLiter: number;
  totalRecords: number;
  totalCost: number;
  totalLiters: number;
};

export type FuelRecordRankingResponse = {
  best: FuelRecordRankingItem[];
  worst: FuelRecordRankingItem[];
};

export type FuelRecordListFilters = {
  vehicleId?: string;
  driverId?: string;
  fuelType?: FuelType | null;
  gasStation?: string;
  anomaly?: boolean | null;
  dateFrom?: string;
  dateTo?: string;
};

export type FuelRecordFormPayload = {
  vehicleId: string;
  driverId?: string | null;
  date: string;
  mileage: number;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  fuelType: FuelType;
  fullTank: boolean;
  gasStation?: string | null;
  notes?: string | null;
  receiptUrl?: string | null;
};

export type FuelRankingFilters = {
  vehicleId?: string;
  driverId?: string;
  fuelType?: FuelType | null;
  gasStation?: string;
  anomaly?: boolean | null;
  dateFrom?: string;
  dateTo?: string;
};
