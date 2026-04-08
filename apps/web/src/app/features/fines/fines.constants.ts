import type { PoComboOption } from '@po-ui/ng-components';
import { FineSeverity } from '@frota-leve/shared/src/enums/fine-severity.enum';
import { FineStatus } from '@frota-leve/shared/src/enums/fine-status.enum';
import { UserRole } from '@frota-leve/shared/src/enums/user-role.enum';

export const FINE_STATUS_OPTIONS: PoComboOption[] = [
  { label: 'Todos os status', value: '' },
  { label: 'Pendente', value: FineStatus.PENDING },
  { label: 'Condutor identificado', value: FineStatus.DRIVER_IDENTIFIED },
  { label: 'Em recurso', value: FineStatus.APPEALED },
  { label: 'Paga', value: FineStatus.PAID },
  { label: 'Descontada em folha', value: FineStatus.PAYROLL_DEDUCTED },
];

export const FINE_SEVERITY_OPTIONS: PoComboOption[] = [
  { label: 'Todas as gravidades', value: '' },
  { label: 'Leve', value: FineSeverity.LIGHT },
  { label: 'Média', value: FineSeverity.MEDIUM },
  { label: 'Grave', value: FineSeverity.SERIOUS },
  { label: 'Gravíssima', value: FineSeverity.VERY_SERIOUS },
];

export const FINE_WORKFLOW_ROLES: UserRole[] = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.FINANCIAL,
];
