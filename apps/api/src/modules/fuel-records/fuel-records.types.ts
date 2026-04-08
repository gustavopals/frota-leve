import type { PlanType } from '@frota-leve/database';

export type FuelRecordActorContext = {
  tenantId: string;
  tenantPlan: PlanType;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

export type FuelRecordListResponse<T> = {
  items: T[];
  hasNext: boolean;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type FuelRecordVehicleInfo = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
};

export type FuelRecordDriverInfo = {
  id: string;
  name: string;
  cpf: string;
};

export type FuelRecordWithRelations = {
  id: string;
  tenantId: string;
  vehicleId: string;
  driverId: string | null;
  date: Date;
  mileage: number;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  fuelType: string;
  fullTank: boolean;
  gasStation: string | null;
  notes: string | null;
  receiptUrl: string | null;
  kmPerLiter: number | null;
  anomaly: boolean;
  anomalyReason: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  vehicle: FuelRecordVehicleInfo;
  driver: FuelRecordDriverInfo | null;
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

export type FuelRecordDeletionResult = {
  deleted: true;
  fuelRecordId: string;
};
