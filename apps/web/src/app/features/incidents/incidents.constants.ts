import type { PoComboOption } from '@po-ui/ng-components';
import type { IncidentStatus, IncidentType } from './incidents.types';

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  COLLISION: 'Colisão',
  THEFT: 'Furto / Roubo',
  VANDALISM: 'Vandalismo',
  NATURAL: 'Evento natural',
  OTHER: 'Outro',
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  REGISTERED: 'Registrado',
  UNDER_ANALYSIS: 'Em análise',
  IN_REPAIR: 'Em reparo',
  CONCLUDED: 'Concluído',
};

export const INCIDENT_TYPE_OPTIONS: PoComboOption[] = [
  { label: 'Colisão', value: 'COLLISION' },
  { label: 'Furto / Roubo', value: 'THEFT' },
  { label: 'Vandalismo', value: 'VANDALISM' },
  { label: 'Evento natural', value: 'NATURAL' },
  { label: 'Outro', value: 'OTHER' },
];

export const INCIDENT_STATUS_OPTIONS: PoComboOption[] = [
  { label: 'Todos os status', value: '' },
  { label: 'Registrado', value: 'REGISTERED' },
  { label: 'Em análise', value: 'UNDER_ANALYSIS' },
  { label: 'Em reparo', value: 'IN_REPAIR' },
  { label: 'Concluído', value: 'CONCLUDED' },
];

export const INCIDENT_TYPE_FILTER_OPTIONS: PoComboOption[] = [
  { label: 'Todos os tipos', value: '' },
  ...INCIDENT_TYPE_OPTIONS,
];

/** Status que permitem edição pelo usuário */
export const INCIDENT_EDITABLE_STATUSES: IncidentStatus[] = [
  'REGISTERED',
  'UNDER_ANALYSIS',
  'IN_REPAIR',
];

/** Ícones de tipo de sinistro */
export const INCIDENT_TYPE_ICON: Record<IncidentType, string> = {
  COLLISION: 'an an-car-crash',
  THEFT: 'an an-lock-simple-open',
  VANDALISM: 'an an-warning',
  NATURAL: 'an an-cloud-lightning',
  OTHER: 'an an-dots-three',
};
