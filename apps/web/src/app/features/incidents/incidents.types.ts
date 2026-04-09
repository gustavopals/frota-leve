export type IncidentStatus = 'REGISTERED' | 'UNDER_ANALYSIS' | 'IN_REPAIR' | 'CONCLUDED';
export type IncidentType = 'COLLISION' | 'THEFT' | 'VANDALISM' | 'NATURAL' | 'OTHER';

export type IncidentVehicle = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
};

export type IncidentDriver = {
  id: string;
  name: string;
  cpf: string;
};

export type IncidentRecord = {
  id: string;
  tenantId: string;
  vehicleId: string;
  driverId: string | null;
  date: string;
  location: string;
  type: IncidentType;
  description: string;
  thirdPartyInvolved: boolean;
  policeReport: boolean;
  insurerNotified: boolean;
  insuranceClaimNumber: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  status: IncidentStatus;
  photos: string[];
  documents: string[];
  downtime: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  vehicle: IncidentVehicle;
  driver: IncidentDriver | null;
};

export type IncidentListResponse = {
  items: IncidentRecord[];
  hasNext: boolean;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type IncidentListFilters = {
  vehicleId?: string;
  driverId?: string;
  status?: IncidentStatus | null;
  type?: IncidentType | null;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type IncidentFormPayload = {
  vehicleId: string;
  driverId?: string | null;
  date: Date;
  location: string;
  type: IncidentType;
  description: string;
  thirdPartyInvolved: boolean;
  policeReport: boolean;
  insurerNotified: boolean;
  insuranceClaimNumber?: string | null;
  estimatedCost?: number | null;
  actualCost?: number | null;
  status?: IncidentStatus;
  photos?: string[];
  documents?: string[];
  downtime?: number | null;
  notes?: string | null;
};

export type UploadFilesResponse = {
  urls: string[];
};

/** Item pendente no uploader antes do envio */
export type PendingFile = {
  file: File;
  preview: string | null; // data URL para imagens
  name: string;
  sizeLabel: string;
  isImage: boolean;
};
