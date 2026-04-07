import type { PoComboOption, PoTableColumnLabel } from '@po-ui/ng-components';
import { PoTagType } from '@po-ui/ng-components';
import { FuelType } from '@frota-leve/shared/src/enums/fuel-type.enum';
import { VehicleCategory } from '@frota-leve/shared/src/enums/vehicle-category.enum';
import { VehicleStatus } from '@frota-leve/shared/src/enums/vehicle-status.enum';

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  [VehicleStatus.ACTIVE]: 'Ativo',
  [VehicleStatus.MAINTENANCE]: 'Manutenção',
  [VehicleStatus.RESERVE]: 'Reserva',
  [VehicleStatus.DECOMMISSIONED]: 'Baixado',
  [VehicleStatus.INCIDENT]: 'Sinistro',
};

export const VEHICLE_STATUS_TAG_TYPES: Record<VehicleStatus, PoTagType> = {
  [VehicleStatus.ACTIVE]: PoTagType.Success,
  [VehicleStatus.MAINTENANCE]: PoTagType.Warning,
  [VehicleStatus.RESERVE]: PoTagType.Neutral,
  [VehicleStatus.DECOMMISSIONED]: PoTagType.Danger,
  [VehicleStatus.INCIDENT]: PoTagType.Danger,
};

export const VEHICLE_STATUS_TABLE_LABELS: PoTableColumnLabel[] = [
  {
    value: VehicleStatus.ACTIVE,
    label: VEHICLE_STATUS_LABELS[VehicleStatus.ACTIVE],
    type: PoTagType.Success,
    icon: true,
  },
  {
    value: VehicleStatus.MAINTENANCE,
    label: VEHICLE_STATUS_LABELS[VehicleStatus.MAINTENANCE],
    type: PoTagType.Warning,
    icon: true,
  },
  {
    value: VehicleStatus.RESERVE,
    label: VEHICLE_STATUS_LABELS[VehicleStatus.RESERVE],
    type: PoTagType.Neutral,
  },
  {
    value: VehicleStatus.DECOMMISSIONED,
    label: VEHICLE_STATUS_LABELS[VehicleStatus.DECOMMISSIONED],
    type: PoTagType.Danger,
    icon: true,
  },
  {
    value: VehicleStatus.INCIDENT,
    label: VEHICLE_STATUS_LABELS[VehicleStatus.INCIDENT],
    type: PoTagType.Danger,
    icon: true,
  },
];

export const VEHICLE_CATEGORY_LABELS: Record<VehicleCategory, string> = {
  [VehicleCategory.LIGHT]: 'Leve',
  [VehicleCategory.HEAVY]: 'Pesado',
  [VehicleCategory.MOTORCYCLE]: 'Moto',
  [VehicleCategory.MACHINE]: 'Máquina',
  [VehicleCategory.BUS]: 'Ônibus',
};

export const VEHICLE_CATEGORY_TABLE_LABELS: PoTableColumnLabel[] = [
  {
    value: VehicleCategory.LIGHT,
    label: VEHICLE_CATEGORY_LABELS[VehicleCategory.LIGHT],
    color: 'color-11',
  },
  {
    value: VehicleCategory.HEAVY,
    label: VEHICLE_CATEGORY_LABELS[VehicleCategory.HEAVY],
    color: 'color-08',
  },
  {
    value: VehicleCategory.MOTORCYCLE,
    label: VEHICLE_CATEGORY_LABELS[VehicleCategory.MOTORCYCLE],
    color: 'color-10',
  },
  {
    value: VehicleCategory.MACHINE,
    label: VEHICLE_CATEGORY_LABELS[VehicleCategory.MACHINE],
    color: 'color-07',
  },
  {
    value: VehicleCategory.BUS,
    label: VEHICLE_CATEGORY_LABELS[VehicleCategory.BUS],
    color: 'color-03',
  },
];

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  [FuelType.GASOLINE]: 'Gasolina',
  [FuelType.ETHANOL]: 'Etanol',
  [FuelType.DIESEL]: 'Diesel',
  [FuelType.DIESEL_S10]: 'Diesel S10',
  [FuelType.GNV]: 'GNV',
  [FuelType.ELECTRIC]: 'Elétrico',
  [FuelType.HYBRID]: 'Híbrido',
};

export const VEHICLE_STATUS_OPTIONS: PoComboOption[] = Object.values(VehicleStatus).map(
  (value) => ({
    label: VEHICLE_STATUS_LABELS[value],
    value,
  }),
);

export const VEHICLE_CATEGORY_OPTIONS: PoComboOption[] = Object.values(VehicleCategory).map(
  (value) => ({
    label: VEHICLE_CATEGORY_LABELS[value],
    value,
  }),
);

export const FUEL_TYPE_OPTIONS: PoComboOption[] = Object.values(FuelType).map((value) => ({
  label: FUEL_TYPE_LABELS[value],
  value,
}));

export const VEHICLE_IMPORT_TEMPLATE = [
  'plate,brand,model,year,yearModel,category,fuelType,status,currentMileage,expectedConsumption,acquisitionDate,acquisitionValue,notes',
  'ABC1D23,Volkswagen,Saveiro 1.6,2023,2024,LIGHT,GASOLINE,ACTIVE,18750,12.4,2024-02-05,89500.00,Veículo de apoio operacional',
].join('\n');
