import { DocumentStatus } from '@frota-leve/shared/src/enums/document-status.enum';
import { DocumentType } from '@frota-leve/shared/src/enums/document-type.enum';
import type {
  DocumentCalendarDay,
  DocumentCalendarItem,
  DocumentCalendarMonth,
  DocumentCalendarWeek,
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

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const monthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const longDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  timeZone: 'UTC',
});

const DOCUMENT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

type DocumentDateParts = {
  year: number;
  month: number;
  day: number;
};

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

const toneRank: Record<DocumentTone, number> = {
  danger: 0,
  warning: 1,
  success: 2,
  neutral: 3,
};

export const DOCUMENT_CALENDAR_WEEKDAY_LABELS = [
  'Dom',
  'Seg',
  'Ter',
  'Qua',
  'Qui',
  'Sex',
  'Sab',
] as const;

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
  const parts = getDocumentDateParts(value);

  if (!parts) {
    return 'Sem data';
  }

  return formatDocumentDateParts(parts);
}

export function formatDocumentDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'Aguardando leitura';
  }

  return dateTimeFormatter.format(new Date(value));
}

export function formatDocumentMonthLabel(value: string | Date): string {
  const parts = getDocumentDateParts(value);

  if (!parts) {
    return '';
  }

  return capitalizeText(monthFormatter.format(createUtcDateFromParts(parts)));
}

export function formatDocumentLongDate(value: string | Date | null | undefined): string {
  const parts = getDocumentDateParts(value);

  if (!parts) {
    return 'Sem data';
  }

  return capitalizeText(longDateFormatter.format(createUtcDateFromParts(parts)));
}

export function toIsoDateInputValue(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const parts = getDocumentDateParts(value);
    return parts ? toDocumentDateKey(parts) : null;
  }

  if (Number.isNaN(value.getTime())) {
    return null;
  }

  return value.toISOString().slice(0, 10);
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

export function startOfDocumentMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

export function shiftDocumentMonth(value: Date, amount: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

export function getDocumentDateKey(value: string | Date | null | undefined): string {
  const parts = getDocumentDateParts(value);
  return parts ? toDocumentDateKey(parts) : '';
}

export function buildDocumentCalendarMonth(
  documents: DocumentRecord[],
  referenceDate: Date,
  today = new Date(),
): DocumentCalendarMonth {
  const normalizedReferenceDate = startOfDocumentMonth(referenceDate);
  const firstDayOfMonth = startOfDocumentMonth(normalizedReferenceDate);
  const lastDayOfMonth = new Date(
    normalizedReferenceDate.getFullYear(),
    normalizedReferenceDate.getMonth() + 1,
    0,
  );
  const calendarStart = new Date(
    normalizedReferenceDate.getFullYear(),
    normalizedReferenceDate.getMonth(),
    1 - firstDayOfMonth.getDay(),
  );
  const calendarEnd = new Date(
    normalizedReferenceDate.getFullYear(),
    normalizedReferenceDate.getMonth() + 1,
    lastDayOfMonth.getDate() + (6 - lastDayOfMonth.getDay()),
  );
  const itemsByDateKey = new Map<string, DocumentCalendarItem[]>();

  for (const document of documents) {
    const dateKey = getDocumentDateKey(document.expirationDate);

    if (!dateKey) {
      continue;
    }

    const items = itemsByDateKey.get(dateKey) ?? [];
    items.push(toCalendarItem(document));
    itemsByDateKey.set(dateKey, items);
  }

  const days: DocumentCalendarDay[] = [];
  const todayKey = getDocumentDateKey(today);

  for (
    const cursor = new Date(calendarStart);
    cursor.getTime() <= calendarEnd.getTime();
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const isoDate = getDocumentDateKey(cursor);
    const items = [...(itemsByDateKey.get(isoDate) ?? [])].sort(compareCalendarItemsByPriority);

    days.push({
      dateKey: isoDate,
      isoDate,
      dayOfMonth: cursor.getDate(),
      isCurrentMonth: cursor.getMonth() === normalizedReferenceDate.getMonth(),
      isToday: isoDate === todayKey,
      total: items.length,
      tone: resolveCalendarDayTone(items),
      items,
    });
  }

  const weeks: DocumentCalendarWeek[] = [];

  for (let index = 0; index < days.length; index += 7) {
    weeks.push({
      id: `week-${index / 7 + 1}`,
      days: days.slice(index, index + 7),
    });
  }

  const currentMonthItems = documents.filter((document) => {
    const documentDate = getDocumentDateParts(document.expirationDate);

    if (!documentDate) {
      return false;
    }

    return (
      documentDate.year === normalizedReferenceDate.getFullYear() &&
      documentDate.month === normalizedReferenceDate.getMonth() + 1
    );
  });
  const chronologicalMonthItems = [...currentMonthItems].sort((left, right) =>
    compareDateStrings(left.expirationDate, right.expirationDate),
  );

  return {
    monthKey: `${normalizedReferenceDate.getFullYear()}-${String(
      normalizedReferenceDate.getMonth() + 1,
    ).padStart(2, '0')}`,
    monthLabel: formatDocumentMonthLabel(normalizedReferenceDate),
    totalItems: currentMonthItems.length,
    daysWithItems: new Set(
      currentMonthItems.map((document) => getDocumentDateKey(document.expirationDate)),
    ).size,
    expiredItems: currentMonthItems.filter((document) => document.status === DocumentStatus.EXPIRED)
      .length,
    expiringItems: currentMonthItems.filter(
      (document) => document.status === DocumentStatus.EXPIRING,
    ).length,
    firstDueDate: chronologicalMonthItems[0]?.expirationDate ?? null,
    lastDueDate:
      chronologicalMonthItems[chronologicalMonthItems.length - 1]?.expirationDate ?? null,
    weeks,
  };
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
  left: string | Date | null | undefined,
  right: string | Date | null | undefined,
): number {
  const leftValue = getComparableDocumentDateValue(left);
  const rightValue = getComparableDocumentDateValue(right);

  if (leftValue == null && rightValue == null) {
    return 0;
  }

  if (leftValue == null) {
    return 1;
  }

  if (rightValue == null) {
    return -1;
  }

  return leftValue - rightValue;
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

function toCalendarItem(document: DocumentRecord): DocumentCalendarItem {
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
  };
}

function compareCalendarItemsByPriority(
  left: DocumentCalendarItem,
  right: DocumentCalendarItem,
): number {
  return (
    toneRank[left.tone] - toneRank[right.tone] ||
    left.daysUntilExpiration - right.daysUntilExpiration ||
    compareDateStrings(left.expirationDate, right.expirationDate) ||
    left.description.localeCompare(right.description, 'pt-BR')
  );
}

function resolveCalendarDayTone(items: DocumentCalendarItem[]): DocumentTone {
  if (items.length === 0) {
    return 'neutral';
  }

  return [...items].sort(compareCalendarItemsByPriority)[0]?.tone ?? 'neutral';
}

function capitalizeText(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getDocumentDateParts(value: string | Date | null | undefined): DocumentDateParts | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    const match = DOCUMENT_DATE_PATTERN.exec(value);

    if (match) {
      return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
      };
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return {
      year: parsed.getUTCFullYear(),
      month: parsed.getUTCMonth() + 1,
      day: parsed.getUTCDate(),
    };
  }

  if (Number.isNaN(value.getTime())) {
    return null;
  }

  return {
    year: value.getFullYear(),
    month: value.getMonth() + 1,
    day: value.getDate(),
  };
}

function formatDocumentDateParts(parts: DocumentDateParts): string {
  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`;
}

function createUtcDateFromParts(parts: DocumentDateParts): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

function toDocumentDateKey(parts: DocumentDateParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function getComparableDocumentDateValue(value: string | Date | null | undefined): number | null {
  const parts = getDocumentDateParts(value);

  if (!parts) {
    return null;
  }

  return Date.UTC(parts.year, parts.month - 1, parts.day);
}
