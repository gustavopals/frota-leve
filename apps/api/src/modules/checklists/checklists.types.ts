import type {
  ChecklistExecutionStatus,
  ChecklistItemStatus,
  PlanType,
  VehicleCategory,
} from '@frota-leve/database';

export type ChecklistActorContext = {
  tenantId: string;
  tenantPlan: PlanType;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

export type ChecklistTemplateListResponse<T> = {
  items: T[];
  hasNext: boolean;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type ChecklistTemplateItemResponse = {
  id: string;
  label: string;
  required: boolean;
  photoRequired: boolean;
  displayOrder: number;
  createdAt: Date;
};

export type ChecklistTemplateResponse = {
  id: string;
  tenantId: string;
  name: string;
  vehicleCategory: VehicleCategory | null;
  createdAt: Date;
  updatedAt: Date;
  items: ChecklistTemplateItemResponse[];
  itemCount: number;
};

export type ChecklistTemplateDeletionResult = {
  deleted: true;
  templateId: string;
};

export type ChecklistExecutionTemplateInfo = {
  id: string;
  name: string;
  vehicleCategory: VehicleCategory | null;
};

export type ChecklistExecutionVehicleInfo = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
};

export type ChecklistExecutionDriverInfo = {
  id: string;
  name: string;
  cpf: string;
};

export type ChecklistExecutionItemResponse = {
  id: string;
  checklistItemId: string | null;
  label: string;
  status: ChecklistItemStatus;
  photoUrl: string | null;
  notes: string | null;
  createdAt: Date;
};

export type ChecklistExecutionResponse = {
  id: string;
  tenantId: string;
  templateId: string;
  vehicleId: string;
  driverId: string | null;
  executedAt: Date;
  status: ChecklistExecutionStatus;
  signatureUrl: string | null;
  location: string | null;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  itemCount: number;
  correctiveServiceOrderId: string | null;
  template: ChecklistExecutionTemplateInfo;
  vehicle: ChecklistExecutionVehicleInfo;
  driver: ChecklistExecutionDriverInfo | null;
  items: ChecklistExecutionItemResponse[];
};

export type ChecklistExecutionListResponse =
  ChecklistTemplateListResponse<ChecklistExecutionResponse>;

export type ChecklistComplianceGranularity = 'day' | 'month';

export type ChecklistComplianceSummary = {
  totalExecutions: number;
  compliantExecutions: number;
  attentionExecutions: number;
  nonCompliantExecutions: number;
  complianceRate: number;
  attentionRate: number;
  nonComplianceRate: number;
  dateFrom: Date | null;
  dateTo: Date | null;
};

export type ChecklistComplianceByStatus = {
  status: ChecklistExecutionStatus;
  count: number;
  percentage: number;
};

export type ChecklistComplianceByPeriod = {
  period: string;
  label: string;
  totalExecutions: number;
  compliantExecutions: number;
  attentionExecutions: number;
  nonCompliantExecutions: number;
  complianceRate: number;
};

export type ChecklistComplianceResponse = {
  summary: ChecklistComplianceSummary;
  byStatus: ChecklistComplianceByStatus[];
  byPeriod: ChecklistComplianceByPeriod[];
};
