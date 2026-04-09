import type { VehicleCategory } from '@frota-leve/shared/src/enums/vehicle-category.enum';
import type { ChecklistExecutionStatus } from '@frota-leve/shared/src/enums/checklist-execution-status.enum';
import type { ChecklistItemStatus } from '@frota-leve/shared/src/enums/checklist-status.enum';

export type ChecklistTemplateItemRecord = {
  id: string;
  label: string;
  required: boolean;
  photoRequired: boolean;
  displayOrder: number;
  createdAt: string;
};

export type ChecklistTemplateRecord = {
  id: string;
  tenantId: string;
  name: string;
  vehicleCategory: VehicleCategory | null;
  createdAt: string;
  updatedAt: string;
  items: ChecklistTemplateItemRecord[];
  itemCount: number;
};

export type ChecklistTemplateListResponse = {
  items: ChecklistTemplateRecord[];
  hasNext: boolean;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type ChecklistTemplateFilters = {
  search?: string;
  vehicleCategory?: VehicleCategory | '';
};

export type ChecklistTemplatePayload = {
  name: string;
  vehicleCategory?: VehicleCategory | null;
  items: Array<{
    label: string;
    required: boolean;
    photoRequired: boolean;
  }>;
};

export type ChecklistTemplateDeletionResponse = {
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

export type ChecklistExecutionItemRecord = {
  id: string;
  checklistItemId: string | null;
  label: string;
  status: ChecklistItemStatus;
  photoUrl: string | null;
  notes: string | null;
  createdAt: string;
};

export type ChecklistExecutionRecord = {
  id: string;
  tenantId: string;
  templateId: string;
  vehicleId: string;
  driverId: string | null;
  executedAt: string;
  status: ChecklistExecutionStatus;
  signatureUrl: string | null;
  location: string | null;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: string;
  itemCount: number;
  correctiveServiceOrderId: string | null;
  template: ChecklistExecutionTemplateInfo;
  vehicle: ChecklistExecutionVehicleInfo;
  driver: ChecklistExecutionDriverInfo | null;
  items: ChecklistExecutionItemRecord[];
};

export type ChecklistExecutionListResponse = {
  items: ChecklistExecutionRecord[];
  hasNext: boolean;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type ChecklistExecutionFilters = {
  vehicleId?: string;
  driverId?: string;
  dateFrom?: string;
  dateTo?: string;
};
