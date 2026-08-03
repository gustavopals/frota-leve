export type UserRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'FINANCIAL' | 'DRIVER' | 'VIEWER';

export interface AuthUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
}

export interface AuthTenant {
  id: string;
  name: string;
  plan: string;
  status: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  tenant: AuthTenant;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface MobileVehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  category: string;
  fuelType: string;
  status: string;
  currentMileage: number;
  averageConsumption: number | null;
  photos: string[];
}

export interface MobileDriver {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  photoUrl: string | null;
  cnhCategory: string | null;
  cnhExpiration: string | null;
  score: number;
}

export interface MobileMaintenanceItem {
  id: string;
  description: string;
  status: string;
  nextDueAt: string | null;
  nextDueMileage: number | null;
}

export interface MobileServiceOrder {
  id: string;
  description: string;
  status: string;
  startDate: string | null;
  workshop: string | null;
}

export interface MobileScore {
  score: number;
  rank: number | null;
  totalDrivers: number;
  breakdown: Record<string, number> | null;
  badges: DriverBadge[];
}

export interface DriverBadge {
  code: string;
  label: string;
  description: string;
  earned: boolean;
}

export interface ResponsibilityTerm {
  id: string;
  status: 'PENDING' | 'SIGNED';
  contentVersion: string;
  content: string;
  signedAt: string | null;
  signatureUrl: string | null;
}

export interface MobileContext {
  user: AuthUser;
  tenant: AuthTenant;
  driver: MobileDriver;
  vehicle: MobileVehicle | null;
  maintenance: MobileMaintenanceItem[];
  serviceOrders: MobileServiceOrder[];
  score: MobileScore;
  unreadNotifications: number;
  responsibilityTerm: ResponsibilityTerm | null;
  refreshedAt: string;
}

export interface ChecklistTemplateItem {
  id: string;
  label: string;
  required: boolean;
  photoRequired: boolean;
  displayOrder: number;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  vehicleCategory: string | null;
  items: ChecklistTemplateItem[];
}

export interface MobileNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  isRead: boolean;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  hasNext: boolean;
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export type ChecklistItemStatus = 'OK' | 'ATTENTION' | 'NON_COMPLIANT';

export interface ChecklistSubmission {
  templateId: string;
  executedAt: string;
  location: string | null;
  notes: string | null;
  items: Array<{
    checklistItemId: string;
    status: ChecklistItemStatus;
    notes: string | null;
    photoUrl?: string | null;
  }>;
  signatureUrl?: string | null;
}

export interface FuelSubmission {
  date: string;
  mileage: number;
  liters: number;
  pricePerLiter: number;
  totalCost: number;
  fuelType: string;
  fullTank: boolean;
  gasStation: string | null;
  notes: string | null;
  receiptUrl?: string | null;
}

export interface ProblemSubmission {
  date: string;
  location: string;
  type: string;
  description: string;
  thirdPartyInvolved: boolean;
  policeReport: boolean;
  photos?: string[];
}
