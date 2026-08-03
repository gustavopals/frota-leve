import type { PoSelectOption } from '@po-ui/ng-components';
import type { AnomalyKind, AnomalySeverity, AnomalyStatus } from './ai-anomalies.types';

/** Roles que podem tratar um alerta — espelha o authorize das rotas do backend. */
export const ANOMALY_WORKFLOW_ROLES = ['OWNER', 'ADMIN', 'MANAGER'];

export const ANOMALY_KIND_LABELS: Record<AnomalyKind, string> = {
  FUEL_DEVIATION: 'Desvio de consumo',
  MAINT_COST: 'Custo de manutenção',
  FINE_PATTERN: 'Reincidência de multas',
  COST_PER_KM_TREND: 'Custo por km em alta',
  OTHER: 'Outra',
};

export const ANOMALY_SEVERITY_LABELS: Record<AnomalySeverity, string> = {
  HIGH: 'Alta',
  MED: 'Média',
  LOW: 'Baixa',
};

export const ANOMALY_STATUS_LABELS: Record<AnomalyStatus, string> = {
  OPEN: 'Aberta',
  ACK: 'Reconhecida',
  DISMISSED: 'Descartada',
};

export const ANOMALY_KIND_OPTIONS: PoSelectOption[] = (
  Object.keys(ANOMALY_KIND_LABELS) as AnomalyKind[]
).map((kind) => ({ label: ANOMALY_KIND_LABELS[kind], value: kind }));

export const ANOMALY_SEVERITY_OPTIONS: PoSelectOption[] = (
  Object.keys(ANOMALY_SEVERITY_LABELS) as AnomalySeverity[]
).map((severity) => ({ label: ANOMALY_SEVERITY_LABELS[severity], value: severity }));

export const ANOMALY_STATUS_OPTIONS: PoSelectOption[] = (
  Object.keys(ANOMALY_STATUS_LABELS) as AnomalyStatus[]
).map((status) => ({ label: ANOMALY_STATUS_LABELS[status], value: status }));
