export type TireStatus = 'NEW' | 'IN_USE' | 'RETREADED' | 'DISCARDED';

export type TireVehicle = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
};

export type TireRecord = {
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
  createdAt: string;
  updatedAt: string;
  currentVehicle: TireVehicle | null;
};

export type TireListResponse = {
  items: TireRecord[];
  hasNext: boolean;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type TireListFilters = {
  status?: TireStatus | null;
  currentVehicleId?: string;
  search?: string;
};

export type TireInspectionUser = {
  id: string;
  name: string;
  email: string;
};

export type TireInspectionRecord = {
  id: string;
  tenantId: string;
  tireId: string;
  vehicleId: string;
  inspectedByUserId: string;
  date: string;
  grooveDepth: number;
  position: string;
  photos: string[];
  notes: string | null;
  createdAt: string;
  vehicle: TireVehicle;
  inspectedByUser: TireInspectionUser;
};

export type TireInspectionListResponse = {
  items: TireInspectionRecord[];
  hasNext: boolean;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

/** Posição normalizada para uso no mapa SVG */
export type TireMapPosition = {
  code: string;
  label: string;
  axle: number;
  side: 'left' | 'right';
  slot: 'single' | 'inner' | 'outer';
  spare?: boolean;
};
