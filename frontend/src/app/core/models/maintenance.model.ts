export interface MaintenancePlan {
  id: string;
  name: string;
  description?: string;
  triggerType: 'KM' | 'TIME' | 'BOTH';
  intervalKm?: number;
  intervalDays?: number;
  estimatedCost?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Maintenance {
  id: string;
  vehicleId: string;
  maintenancePlanId?: string;
  date: string;
  odometer?: number;
  cost: number;
  provider?: string;
  notes?: string;
  createdAt: string;
  vehicle?: {
    id: string;
    plate: string;
    model: string;
    brand: string;
  };
  plan?: {
    id: string;
    name: string;
  };
}

export interface UpcomingMaintenance {
  vehicleId: string;
  vehiclePlate: string;
  vehicleModel: string;
  planId: string;
  planName: string;
  nextDueDate: string | null;
  nextDueKm: number | null;
  currentKm: number;
  status: 'OK' | 'WARNING' | 'OVERDUE';
  lastMaintenanceDate: string | null;
}

export interface MaintenanceStats {
  totalMaintenances: number;
  totalCost: number;
  monthlyMaintenances: number;
  monthlyCost: number;
  overdueCount: number;
}
