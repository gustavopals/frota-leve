import { DocumentStatus } from '@frota-leve/shared/src/enums/document-status.enum';
import { DocumentType } from '@frota-leve/shared/src/enums/document-type.enum';
import type {
  DocumentPriorityItem,
  DocumentRecord,
  DocumentSemaphoreTone,
  DocumentStatus as DocumentStatusType,
  DocumentTone,
  DocumentType as DocumentTypeValue,
  DocumentTypeCardSummary,
  PendingDocumentBucketKey,
  PendingDocumentsResponse,
} from './documents.types';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const documentTypeLabels: Record<DocumentTypeValue, string> = {
  [DocumentType.IPVA]: 'IPVA',
  [DocumentType.LICENSING]: 'Licenciamento',
  [DocumentType.INSURANCE]: 'Seguro',
  [DocumentType.CNH]: 'CNH',
  [DocumentType.ANTT]: 'ANTT',
  [DocumentType.AET]: 'AET',
  [DocumentType.MOPP]: 'MOPP',
  [DocumentType.INSPECTION]: 'Inspecao',
  [DocumentType.OTHER]: 'Outros',
};

const pendingBucketLabels: Record<PendingDocumentBucketKey, string> = {
  upTo30Days: 'Ate 30 dias',
  days31To60: '31 a 60 dias',
  days61To90: '61 a 90 dias',
};

const semaphoreToneRank: Record<DocumentSemaphoreTone, number> = {
  red: 0,
  yellow: 1,
  green: 2,
};

const statusRank: Record<DocumentStatusType, number> = {
  [DocumentStatus.EXPIRED]: 0,
  [DocumentStatus.EXPIRING]: 1,
  [DocumentStatus.VALID]: 2,
};

export function createEmptyPendingDocumentsResponse(): PendingDocumentsResponse {
  return {
    generatedAt: '',
    summary: {
      upTo30Days: 0,
      upTo60Days: 0,
      upTo90Days: 0,
      total: 0,
    },
    buckets: {
      upTo30Days: [],
      days31To60: [],
      days61To90: [],
    },
  };
}

export function formatDocumentDate(value: string | null | undefined): string {
  if (!value) {
    return 'Sem data';
  }

  return dateFormatter.format(new Date(value));
}

export function formatDocumentDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'Aguardando leitura';
  }

  return dateTimeFormatter.format(new Date(value));
}

export function getDocumentTypeLabel(type: DocumentTypeValue): string {
  return documentTypeLabels[type];
}

export function getDocumentStatusMeta(status: DocumentStatusType): {
  label: string;
  tone: DocumentTone;
} {
  switch (status) {
    case DocumentStatus.EXPIRED:
      return {
        label: 'Vencido',
        tone: 'danger',
      };
    case DocumentStatus.EXPIRING:
      return {
        label: 'Proximo',
        tone: 'warning',
      };
    default:
      return {
        label: 'Em dia',
        tone: 'success',
      };
  }
}

export function getPendingBucketLabel(bucket: PendingDocumentBucketKey): string {
  return pendingBucketLabels[bucket];
}

export function formatDocumentTargetLabel(document: DocumentRecord): string {
  const labels: string[] = [];

  if (document.vehicle) {
    labels.push(`${document.vehicle.plate} - ${document.vehicle.brand} ${document.vehicle.model}`);
  }

  if (document.driver) {
    labels.push(document.driver.name);
  }

  return labels.join(' / ') || 'Sem vinculo definido';
}

export function flattenPendingDocuments(pending: PendingDocumentsResponse): DocumentRecord[] {
  return ['upTo30Days', 'days31To60', 'days61To90'].flatMap(
    (bucket) => pending.buckets[bucket as PendingDocumentBucketKey],
  );
}

export function buildDocumentTypeCards(documents: DocumentRecord[]): DocumentTypeCardSummary[] {
  const groupedDocuments = new Map<DocumentTypeValue, DocumentRecord[]>();

  for (const document of documents) {
    const group = groupedDocuments.get(document.type) ?? [];
    group.push(document);
    groupedDocuments.set(document.type, group);
  }

  return Array.from(groupedDocuments.entries())
    .map(([type, items]) => {
      const orderedItems = [...items].sort(compareDocumentsByPriority);
      const focusDocument = orderedItems[0] ?? null;
      const tone = resolveSemaphoreTone(items);
      const vehicleCount = countDistinctTargets(items, 'vehicle');
      const driverCount = countDistinctTargets(items, 'driver');

      return {
        type,
        label: getDocumentTypeLabel(type),
        tone,
        toneLabel: getSemaphoreToneLabel(tone),
        total: items.length,
        validCount: items.filter((item) => item.status === DocumentStatus.VALID).length,
        expiringCount: items.filter((item) => item.status === DocumentStatus.EXPIRING).length,
        expiredCount: items.filter((item) => item.status === DocumentStatus.EXPIRED).length,
        targetSummary: formatTargetSummary(vehicleCount, driverCount),
        focusLabel: buildFocusLabel(focusDocument),
        nextExpirationDate: focusDocument?.expirationDate ?? null,
        totalCost: items.reduce((total, item) => total + (item.cost ?? 0), 0),
      };
    })
    .sort(
      (left, right) =>
        semaphoreToneRank[left.tone] - semaphoreToneRank[right.tone] ||
        compareDateStrings(left.nextExpirationDate, right.nextExpirationDate) ||
        left.label.localeCompare(right.label, 'pt-BR'),
    );
}

export function buildPriorityItems(
  documents: DocumentRecord[],
  pending: PendingDocumentsResponse,
): DocumentPriorityItem[] {
  const uniqueDocuments = new Map<string, DocumentRecord>();

  for (const document of documents.filter((item) => item.status === DocumentStatus.EXPIRED)) {
    uniqueDocuments.set(document.id, document);
  }

  for (const document of flattenPendingDocuments(pending)) {
    uniqueDocuments.set(document.id, document);
  }

  return Array.from(uniqueDocuments.values())
    .sort(compareDocumentsByPriority)
    .map((document) => {
      const statusMeta = getDocumentStatusMeta(document.status);

      return {
        id: document.id,
        type: document.type,
        typeLabel: getDocumentTypeLabel(document.type),
        description: document.description,
        expirationDate: document.expirationDate,
        daysUntilExpiration: document.daysUntilExpiration,
        status: document.status,
        statusLabel: statusMeta.label,
        tone: statusMeta.tone,
        targetLabel: formatDocumentTargetLabel(document),
        bucketLabel: resolvePriorityBucketLabel(document),
        deadlineLabel: formatDeadlineLabel(document.daysUntilExpiration),
      };
    });
}

function resolveSemaphoreTone(documents: DocumentRecord[]): DocumentSemaphoreTone {
  if (documents.some((item) => item.status === DocumentStatus.EXPIRED)) {
    return 'red';
  }

  if (documents.some((item) => item.status === DocumentStatus.EXPIRING)) {
    return 'yellow';
  }

  return 'green';
}

function getSemaphoreToneLabel(tone: DocumentSemaphoreTone): string {
  switch (tone) {
    case 'red':
      return 'Critico';
    case 'yellow':
      return 'Atencao';
    default:
      return 'Em dia';
  }
}

function buildFocusLabel(document: DocumentRecord | null): string {
  if (!document) {
    return 'Sem vencimento monitorado.';
  }

  if (document.status === DocumentStatus.EXPIRED) {
    return `Vencido ha ${Math.abs(document.daysUntilExpiration)} dias (${formatDocumentDate(document.expirationDate)})`;
  }

  if (document.status === DocumentStatus.EXPIRING) {
    return `Vence em ${document.daysUntilExpiration} dias (${formatDocumentDate(document.expirationDate)})`;
  }

  return `Proximo ciclo em ${formatDocumentDate(document.expirationDate)}`;
}

function formatTargetSummary(vehicleCount: number, driverCount: number): string {
  const parts: string[] = [];

  if (vehicleCount > 0) {
    parts.push(`${vehicleCount} ${vehicleCount === 1 ? 'veiculo' : 'veiculos'}`);
  }

  if (driverCount > 0) {
    parts.push(`${driverCount} ${driverCount === 1 ? 'motorista' : 'motoristas'}`);
  }

  return parts.join(' / ') || 'Sem vinculos';
}

function countDistinctTargets(documents: DocumentRecord[], key: 'vehicle' | 'driver'): number {
  return new Set(
    documents
      .map((item) => item[key]?.id ?? null)
      .filter((value): value is string => value !== null),
  ).size;
}

function compareDocumentsByPriority(left: DocumentRecord, right: DocumentRecord): number {
  return (
    statusRank[left.status] - statusRank[right.status] ||
    left.daysUntilExpiration - right.daysUntilExpiration ||
    compareDateStrings(left.expirationDate, right.expirationDate) ||
    left.description.localeCompare(right.description, 'pt-BR')
  );
}

function compareDateStrings(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return new Date(left).getTime() - new Date(right).getTime();
}

function resolvePriorityBucketLabel(document: DocumentRecord): string {
  if (document.status === DocumentStatus.EXPIRED) {
    return 'Vencido';
  }

  if (document.daysUntilExpiration <= 30) {
    return getPendingBucketLabel('upTo30Days');
  }

  if (document.daysUntilExpiration <= 60) {
    return getPendingBucketLabel('days31To60');
  }

  return getPendingBucketLabel('days61To90');
}

function formatDeadlineLabel(daysUntilExpiration: number): string {
  if (daysUntilExpiration < 0) {
    return `${Math.abs(daysUntilExpiration)} dias em atraso`;
  }

  if (daysUntilExpiration === 0) {
    return 'Vence hoje';
  }

  if (daysUntilExpiration === 1) {
    return 'Vence amanha';
  }

  return `Vence em ${daysUntilExpiration} dias`;
}
