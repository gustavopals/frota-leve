import type { PoComboOption } from '@po-ui/ng-components';
import { CNH_CATEGORIES } from '@frota-leve/shared/src/dtos/driver.dto';

export type DriverActivityOptionValue = 'active' | 'inactive';
export type DriverCnhAlertOptionValue = 'alert';

export const DRIVER_STATUS_FILTER_OPTIONS: PoComboOption[] = [
  { label: 'Somente ativos', value: 'active' satisfies DriverActivityOptionValue },
  { label: 'Somente inativos', value: 'inactive' satisfies DriverActivityOptionValue },
];

export const DRIVER_STATUS_FORM_OPTIONS: PoComboOption[] = [
  { label: 'Ativo', value: 'active' satisfies DriverActivityOptionValue },
  { label: 'Inativo', value: 'inactive' satisfies DriverActivityOptionValue },
];

export const DRIVER_CNH_ALERT_OPTIONS: PoComboOption[] = [
  { label: 'Somente com alerta de CNH', value: 'alert' satisfies DriverCnhAlertOptionValue },
];

export const DRIVER_CNH_CATEGORY_OPTIONS: PoComboOption[] = CNH_CATEGORIES.map((value) => ({
  label: value,
  value,
}));
