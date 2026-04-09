export type FinancialOverviewFilters = {
  dateFrom?: string;
  dateTo?: string;
  monthlyBudget?: number | null;
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

export type FinancialVehicleOption = FinancialVehicleInfo & {
  label: string;
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
    dateFrom: string | null;
    dateTo: string | null;
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

export type FinancialCategoryKey = 'fuel' | 'maintenance' | 'tires' | 'fines' | 'documents';

export type FinancialVehicleCostBreakdown = Record<FinancialCategoryKey, number>;

export type FinancialVehicleCostItem = {
  vehicleId: string;
  plate: string;
  label: string;
  categoryLabel: string;
  acquisitionValue: number | null;
  currentMileage: number;
  components: FinancialVehicleCostBreakdown;
  total: number;
  costPerKm: number | null;
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

export type FinancialComparisonVehicle = {
  vehicle: FinancialVehicleInfo;
  components: FinancialVehicleCostBreakdown;
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
