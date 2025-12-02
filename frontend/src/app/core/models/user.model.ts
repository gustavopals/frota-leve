export enum UserRole {
  ADMIN_EMPRESA = 'ADMIN_EMPRESA',
  GESTOR_FROTA = 'GESTOR_FROTA',
  MOTORISTA = 'MOTORISTA'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId: string;
  createdAt: Date;
}
