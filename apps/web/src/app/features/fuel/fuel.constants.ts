import type { PoComboOption } from '@po-ui/ng-components';
import type { FuelType } from '@frota-leve/shared/src/enums/fuel-type.enum';

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  GASOLINE: 'Gasolina',
  ETHANOL: 'Etanol',
  DIESEL: 'Diesel',
  DIESEL_S10: 'Diesel S10',
  GNV: 'GNV',
  ELECTRIC: 'Elétrico',
  HYBRID: 'Híbrido',
};

export const FUEL_TYPE_OPTIONS: PoComboOption[] = Object.entries(FUEL_TYPE_LABELS).map(
  ([value, label]) => ({ label, value }),
);

export const FUEL_ANOMALY_OPTIONS: PoComboOption[] = [
  { label: 'Somente anomalias', value: 'true' },
];

export const FUEL_TANK_MODE_OPTIONS: PoComboOption[] = [
  { label: 'Tanque cheio', value: 'full' },
  { label: 'Abastecimento parcial', value: 'partial' },
];
