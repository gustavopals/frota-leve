import type { PoComboOption } from '@po-ui/ng-components';
import { MaintenanceType } from '@frota-leve/shared/src/enums/maintenance-type.enum';
import { ServiceOrderStatus } from '@frota-leve/shared/src/enums/os-status.enum';
import { UserRole } from '@frota-leve/shared/src/enums/user-role.enum';

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

export const SERVICE_ORDER_STATUS_OPTIONS: PoComboOption[] = [
  { label: 'Todos os status', value: '' },
  { label: 'Aberta', value: ServiceOrderStatus.OPEN },
  { label: 'Aprovada', value: ServiceOrderStatus.APPROVED },
  { label: 'Em execução', value: ServiceOrderStatus.IN_PROGRESS },
  { label: 'Concluída', value: ServiceOrderStatus.COMPLETED },
  { label: 'Cancelada', value: ServiceOrderStatus.CANCELLED },
];

export const SERVICE_ORDER_WORKFLOW_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
];
