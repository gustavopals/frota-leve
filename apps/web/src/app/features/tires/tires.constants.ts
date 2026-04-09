import type { PoComboOption } from '@po-ui/ng-components';
import type { TireStatus } from './tires.types';

export const TIRE_STATUS_OPTIONS: PoComboOption[] = [
  { label: 'Todos', value: '' },
  { label: 'Novo', value: 'NEW' },
  { label: 'Em uso', value: 'IN_USE' },
  { label: 'Recapado', value: 'RETREADED' },
  { label: 'Descartado', value: 'DISCARDED' },
];

export const TIRE_STATUS_LABELS: Record<TireStatus, string> = {
  NEW: 'Novo',
  IN_USE: 'Em uso',
  RETREADED: 'Recapado',
  DISCARDED: 'Descartado',
};

/** Limite padrão de sulco para alerta (mm) */
export const DEFAULT_GROOVE_THRESHOLD_MM = 3;

/**
 * Posições padronizadas de pneu em veículos de frota.
 * E = Eixo, E1 = dianteiro, E2 = primeiro eixo traseiro, E3 = segundo eixo traseiro
 * D = Direito, E = Esquerdo, I = Interno, X = Externo
 */
export const TIRE_POSITION_CODES = [
  'E1E',
  'E1D',
  'E2E',
  'E2D',
  'E2EI',
  'E2EE',
  'E2DI',
  'E2DE',
  'E3E',
  'E3D',
  'E3EI',
  'E3EE',
  'E3DI',
  'E3DE',
  'ES',
] as const;

export type TirePositionCode = (typeof TIRE_POSITION_CODES)[number];
