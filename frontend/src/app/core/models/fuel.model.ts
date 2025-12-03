export interface FuelLog {
  id: string;
  vehicleId: string;
  driverId?: string;
  date: string;
  station: string;
  liters: number;
  totalValue: number;
  odometer: number;
  notes?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  vehicle?: {
    id: string;
    plate: string;
    model: string;
    brand: string;
  };
  driver?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface FuelAnalytics {
  vehicleId: string;
  totalRefuels: number;
  totalLiters: number;
  totalSpent: number;
  averageConsumption: number | null;
  averagePricePerLiter: number | null;
  totalDistance?: number;
}

export interface FuelStats {
  totalRefuels: number;
  totalLiters: number;
  totalSpent: number;
  averagePricePerLiter: number;
}
