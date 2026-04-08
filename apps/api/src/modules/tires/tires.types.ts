import type { PlanType, TireStatus } from '@frota-leve/database';

export type TireActorContext = {
  tenantId: string;
  tenantPlan: PlanType;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

export type TireListResponse<T> = {
  items: T[];
  hasNext: boolean;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type TireVehicleInfo = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
};

export type TireInspectionUserInfo = {
  id: string;
  name: string;
  email: string;
};

export type TireWithRelations = {
  id: string;
  tenantId: string;
  brand: string;
  model: string;
  size: string;
  serialNumber: string;
  dot: string;
  status: TireStatus;
  currentVehicleId: string | null;
  position: string | null;
  currentGrooveDepth: number;
  originalGrooveDepth: number;
  retreatCount: number;
  costNew: number;
  costRetreat: number;
  totalKm: number;
  createdAt: Date;
  updatedAt: Date;
  currentVehicle: TireVehicleInfo | null;
};

export type TireDeletionResult = {
  deleted: true;
  tireId: string;
};

export type TireInspectionWearMetrics = {
  previousGrooveDepth: number;
  currentGrooveDepth: number;
  lossSinceLastInspection: number;
  totalLoss: number;
  wearPercentage: number;
  remainingUsefulLifePercentage: number;
};

export type TireInspectionRecord = {
  id: string;
  tenantId: string;
  tireId: string;
  vehicleId: string;
  inspectedByUserId: string;
  date: Date;
  grooveDepth: number;
  position: string;
  photos: string[];
  notes: string | null;
  createdAt: Date;
  vehicle: TireVehicleInfo;
  inspectedByUser: TireInspectionUserInfo;
};

export type TireInspectionResponse = {
  inspection: TireInspectionRecord;
  wear: TireInspectionWearMetrics;
  tire: TireWithRelations;
};

export type TireReplacementAlertItem = TireWithRelations & {
  threshold: number;
  mmBelowThreshold: number;
  remainingUsefulLifePercentage: number;
};

export type TireReplacementAlertsResponse = {
  items: TireReplacementAlertItem[];
  summary: {
    total: number;
    threshold: number;
    averageGrooveDepth: number | null;
    lowestGrooveDepth: number | null;
  };
};

export type TireCostStatsItem = TireWithRelations & {
  totalCost: number;
  retreatInvestment: number;
  costPerKm: number | null;
  costPerThousandKm: number | null;
};

export type TireBrandComparisonItem = {
  brand: string;
  tireCount: number;
  tiresWithKm: number;
  totalKm: number;
  totalCost: number;
  averageCostPerKm: number | null;
  averageCostPerThousandKm: number | null;
  averageKmPerTire: number | null;
  averageRetreatCount: number;
};

export type TireStatsResponse = {
  summary: {
    totalTires: number;
    tiresWithKm: number;
    tiresWithoutKm: number;
    totalKm: number;
    totalCost: number;
    averageCostPerKm: number | null;
    averageCostPerThousandKm: number | null;
    bestBrand: string | null;
    worstBrand: string | null;
  };
  byTire: TireCostStatsItem[];
  byBrand: TireBrandComparisonItem[];
};
