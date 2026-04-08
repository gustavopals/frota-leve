import type { DocumentStatus, DocumentType, PlanType } from '@frota-leve/database';

export type DocumentActorContext = {
  tenantId: string;
  tenantPlan: PlanType;
  userId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

export type DocumentListResponse<T> = {
  items: T[];
  hasNext: boolean;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type DocumentVehicleInfo = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
};

export type DocumentDriverInfo = {
  id: string;
  name: string;
  cpf: string;
  cnhNumber: string | null;
};

export type DocumentWithRelations = {
  id: string;
  tenantId: string;
  vehicleId: string | null;
  driverId: string | null;
  type: DocumentType;
  description: string;
  expirationDate: Date;
  alertDaysBefore: number;
  cost: number | null;
  fileUrl: string;
  status: DocumentStatus;
  notes: string | null;
  createdAt: Date;
  daysUntilExpiration: number;
  vehicle: DocumentVehicleInfo | null;
  driver: DocumentDriverInfo | null;
};

export type DocumentDeletionResult = {
  deleted: true;
  documentId: string;
};

export type PendingDocumentBucketKey = 'upTo30Days' | 'days31To60' | 'days61To90';

export type PendingDocumentItem = DocumentWithRelations & {
  bucket: PendingDocumentBucketKey;
};

export type PendingDocumentsResponse = {
  generatedAt: string;
  summary: {
    upTo30Days: number;
    upTo60Days: number;
    upTo90Days: number;
    total: number;
  };
  buckets: Record<PendingDocumentBucketKey, PendingDocumentItem[]>;
};
