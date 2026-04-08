import type { DocumentStatus } from '@frota-leve/shared/src/enums/document-status.enum';
import type { DocumentType } from '@frota-leve/shared/src/enums/document-type.enum';

export type { DocumentStatus } from '@frota-leve/shared/src/enums/document-status.enum';
export type { DocumentType } from '@frota-leve/shared/src/enums/document-type.enum';

export type DocumentRecordVehicle = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
};

export type DocumentRecordDriver = {
  id: string;
  name: string;
  cpf: string;
  cnhNumber: string | null;
};

export type DocumentRecord = {
  id: string;
  tenantId: string;
  vehicleId: string | null;
  driverId: string | null;
  type: DocumentType;
  description: string;
  expirationDate: string;
  alertDaysBefore: number;
  cost: number | null;
  fileUrl: string;
  status: DocumentStatus;
  notes: string | null;
  createdAt: string;
  daysUntilExpiration: number;
  vehicle: DocumentRecordVehicle | null;
  driver: DocumentRecordDriver | null;
};

export type DocumentListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type DocumentListResponse = {
  items: DocumentRecord[];
  hasNext: boolean;
  meta: DocumentListMeta;
};

export type PendingDocumentBucketKey = 'upTo30Days' | 'days31To60' | 'days61To90';

export type PendingDocumentItem = DocumentRecord & {
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

export type DocumentListFilters = {
  type?: DocumentType | null;
  vehicleId?: string;
  driverId?: string;
  status?: DocumentStatus | null;
};

export type PendingDocumentsFilters = {
  type?: DocumentType | null;
  vehicleId?: string;
  driverId?: string;
};

export type DocumentTone = 'success' | 'warning' | 'danger' | 'neutral';

export type DocumentSemaphoreTone = 'green' | 'yellow' | 'red';

export type DocumentTypeCardSummary = {
  type: DocumentType;
  label: string;
  tone: DocumentSemaphoreTone;
  toneLabel: string;
  total: number;
  validCount: number;
  expiringCount: number;
  expiredCount: number;
  targetSummary: string;
  focusLabel: string;
  nextExpirationDate: string | null;
  totalCost: number;
};

export type DocumentPriorityItem = {
  id: string;
  type: DocumentType;
  typeLabel: string;
  description: string;
  expirationDate: string;
  daysUntilExpiration: number;
  status: DocumentStatus;
  statusLabel: string;
  tone: DocumentTone;
  targetLabel: string;
  bucketLabel: string;
  deadlineLabel: string;
};
