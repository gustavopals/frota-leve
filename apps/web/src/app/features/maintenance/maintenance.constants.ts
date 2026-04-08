import type { PoComboOption } from '@po-ui/ng-components';
import { MaintenanceType } from '@frota-leve/shared/src/enums/maintenance-type.enum';

export const MAINTENANCE_TYPE_OPTIONS: PoComboOption[] = [
  { label: 'Preventiva', value: MaintenanceType.PREVENTIVE },
  { label: 'Corretiva', value: MaintenanceType.CORRECTIVE },
  { label: 'Preditiva', value: MaintenanceType.PREDICTIVE },
];

export const MAINTENANCE_ACTIVITY_OPTIONS: PoComboOption[] = [
  { label: 'Todos os planos', value: '' },
  { label: 'Somente ativos', value: 'active' },
  { label: 'Somente inativos', value: 'inactive' },
];
