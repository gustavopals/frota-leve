import { PoTagType } from '@po-ui/ng-components';
import {
  ANOMALY_KIND_LABELS,
  ANOMALY_SEVERITY_LABELS,
  ANOMALY_STATUS_LABELS,
} from './ai-anomalies.constants';
import type { AnomalyKind, AnomalySeverity, AnomalyStatus } from './ai-anomalies.types';

export function formatAnomalyKind(kind: AnomalyKind): string {
  return ANOMALY_KIND_LABELS[kind] ?? kind;
}

export function formatAnomalySeverity(severity: AnomalySeverity): string {
  return ANOMALY_SEVERITY_LABELS[severity] ?? severity;
}

export function formatAnomalyStatus(status: AnomalyStatus): string {
  return ANOMALY_STATUS_LABELS[status] ?? status;
}

export function getSeverityTagType(severity: AnomalySeverity): PoTagType {
  switch (severity) {
    case 'HIGH':
      return PoTagType.Danger;
    case 'MED':
      return PoTagType.Warning;
    default:
      return PoTagType.Info;
  }
}

export function getStatusTagType(status: AnomalyStatus): PoTagType {
  switch (status) {
    case 'OPEN':
      return PoTagType.Warning;
    case 'ACK':
      return PoTagType.Success;
    default:
      return PoTagType.Info;
  }
}

export function formatDetectedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

/** Verde acima de 80, amarelo entre 50 e 80, vermelho abaixo. */
export function getHealthScoreTagType(score: number): PoTagType {
  if (score >= 80) {
    return PoTagType.Success;
  }

  return score >= 50 ? PoTagType.Warning : PoTagType.Danger;
}
