export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  chassisNumber?: string;
  renavam?: string;
  currentKm: number;
  fuelType: string;
  status: 'ATIVO' | 'MANUTENCAO' | 'INATIVO';
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVehicleDto {
  plate: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  chassisNumber?: string;
  renavam?: string;
  currentKm: number;
  fuelType: string;
}
