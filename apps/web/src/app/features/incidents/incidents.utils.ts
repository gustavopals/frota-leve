import { PoTagType } from '@po-ui/ng-components';
import type { IncidentRecord, IncidentStatus, IncidentType, PendingFile } from './incidents.types';
import { INCIDENT_STATUS_LABELS, INCIDENT_TYPE_LABELS } from './incidents.constants';

export function formatIncidentType(type: IncidentType): string {
  return INCIDENT_TYPE_LABELS[type] ?? type;
}

export function formatIncidentStatus(status: IncidentStatus): string {
  return INCIDENT_STATUS_LABELS[status] ?? status;
}

export function getStatusTagType(status: IncidentStatus): PoTagType {
  switch (status) {
    case 'REGISTERED':
      return PoTagType.Info;
    case 'UNDER_ANALYSIS':
      return PoTagType.Warning;
    case 'IN_REPAIR':
      return PoTagType.Warning;
    case 'CONCLUDED':
      return PoTagType.Success;
    default:
      return PoTagType.Neutral;
  }
}

export function formatIncidentDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDowntime(days: number | null | undefined): string {
  if (days == null) return '—';
  return `${days} dia${days !== 1 ? 's' : ''}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function buildPendingFile(file: File): PendingFile {
  return {
    file,
    preview: null, // preenchido async pelo componente
    name: file.name,
    sizeLabel: formatFileSize(file.size),
    isImage: isImageFile(file),
  };
}

export function getTimelineSteps(record: IncidentRecord): {
  status: IncidentStatus;
  label: string;
  done: boolean;
  current: boolean;
  date?: string;
}[] {
  const order: IncidentStatus[] = ['REGISTERED', 'UNDER_ANALYSIS', 'IN_REPAIR', 'CONCLUDED'];
  const currentIndex = order.indexOf(record.status);

  return order.map((status, i) => ({
    status,
    label: INCIDENT_STATUS_LABELS[status],
    done: i < currentIndex,
    current: i === currentIndex,
    date: i === 0 ? record.date : undefined,
  }));
}
