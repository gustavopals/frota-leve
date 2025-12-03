export interface ChecklistTemplateItem {
  id: string;
  templateId: string;
  label: string;
  type: 'BOOLEAN' | 'TEXT' | 'NUMBER' | 'SELECT';
  config?: any;
  sortOrder: number;
}

export interface ChecklistTemplate {
  id: string;
  tenantId: string;
  name: string;
  vehicleType?: string;
  isActive: boolean;
  createdAt: string;
  items: ChecklistTemplateItem[];
  _count?: {
    checklistSubmissions: number;
  };
}

export interface ChecklistAnswer {
  id?: string;
  submissionId?: string;
  templateItemId: string;
  value: string;
  templateItem?: ChecklistTemplateItem;
}

export interface ChecklistSubmission {
  id: string;
  tenantId: string;
  templateId: string;
  vehicleId: string;
  driverId: string;
  submittedAt: string;
  overallStatus: 'OK' | 'ALERT' | 'CRITICAL';
  template?: {
    id: string;
    name: string;
    items?: ChecklistTemplateItem[];
  };
  vehicle?: {
    id: string;
    name: string;
    plate: string;
    brand?: string;
    model?: string;
  };
  driver?: {
    id: string;
    name: string;
    email?: string;
  };
  answers: ChecklistAnswer[];
  _count?: {
    answers: number;
  };
}

export interface ChecklistStats {
  total: number;
  today: number;
  byStatus: {
    OK?: number;
    ALERT?: number;
    CRITICAL?: number;
  };
}
