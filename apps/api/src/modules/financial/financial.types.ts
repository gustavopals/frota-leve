import type { PlanType } from '@frota-leve/database';

export type FinancialActorContext = {
  tenantId: string;
  tenantPlan: PlanType;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

export type FinancialVehicleInfo = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  currentMileage: number;
  acquisitionValue: number | null;
};

export type FinancialTcoComponents = {
  fuel: number;
  maintenance: number;
  tires: number;
  fines: number;
  documents: number;
  depreciation: number | null;
};

export type FinancialTcoResponse = {
  vehicle: FinancialVehicleInfo;
  components: FinancialTcoComponents;
  totals: {
    operational: number;
    tco: number;
    costPerKm: number | null;
  };
  depreciation: {
    acquisitionValue: number | null;
    currentMarketValue: number | null;
    amount: number | null;
    included: boolean;
  };
  warnings: string[];
};

export type FinancialOverviewCategoryTotals = {
  fuel: number;
  maintenance: number;
  tires: number;
  fines: number;
  documents: number;
  total: number;
};

export type FinancialOverviewMonthlyItem = FinancialOverviewCategoryTotals & {
  period: string;
  label: string;
  budget: number | null;
  variance: number | null;
};

export type FinancialOverviewResponse = {
  summary: FinancialOverviewCategoryTotals & {
    vehicles: number;
    dateFrom: Date | null;
    dateTo: Date | null;
  };
  monthly: FinancialOverviewMonthlyItem[];
  budget: {
    configured: boolean;
    monthlyBudget: number | null;
    totalBudget: number | null;
    realized: number;
    variance: number | null;
    variancePercent: number | null;
  };
  warnings: string[];
};

export type FinancialComparisonVehicle = {
  vehicle: FinancialVehicleInfo;
  components: Omit<FinancialTcoComponents, 'depreciation'>;
  totals: {
    operational: number;
    costPerKm: number | null;
  };
};

export type FinancialComparisonResponse = {
  referenceVehicle: FinancialComparisonVehicle;
  similarVehicles: FinancialComparisonVehicle[];
  benchmark: {
    vehicleCount: number;
    averageOperational: number;
    averageCostPerKm: number | null;
    referenceRankByCostPerKm: number | null;
  };
  comparisonKey: {
    brand: string;
    model: string;
    year: number;
  };
  warnings: string[];
};
