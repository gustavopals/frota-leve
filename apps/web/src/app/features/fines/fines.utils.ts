import { PoTagType } from '@po-ui/ng-components';
import { FineSeverity } from '@frota-leve/shared/src/enums/fine-severity.enum';
import { FineStatus } from '@frota-leve/shared/src/enums/fine-status.enum';

export function formatFineStatus(status: FineStatus): string {
  const labels: Record<FineStatus, string> = {
    [FineStatus.PENDING]: 'Pendente',
    [FineStatus.DRIVER_IDENTIFIED]: 'Condutor identificado',
    [FineStatus.APPEALED]: 'Em recurso',
    [FineStatus.PAID]: 'Paga',
    [FineStatus.PAYROLL_DEDUCTED]: 'Descontada em folha',
  };
  return labels[status] ?? status;
}

export function formatFineSeverity(severity: FineSeverity): string {
  const labels: Record<FineSeverity, string> = {
    [FineSeverity.LIGHT]: 'Leve',
    [FineSeverity.MEDIUM]: 'Média',
    [FineSeverity.SERIOUS]: 'Grave',
    [FineSeverity.VERY_SERIOUS]: 'Gravíssima',
  };
  return labels[severity] ?? severity;
}

export function getStatusTagType(status: FineStatus): PoTagType {
  switch (status) {
    case FineStatus.PENDING:
      return PoTagType.Warning;
    case FineStatus.DRIVER_IDENTIFIED:
      return PoTagType.Info;
    case FineStatus.APPEALED:
      return PoTagType.Neutral;
    case FineStatus.PAID:
      return PoTagType.Success;
    case FineStatus.PAYROLL_DEDUCTED:
      return PoTagType.Success;
    default:
      return PoTagType.Neutral;
  }
}

export function getSeverityTagType(severity: FineSeverity): PoTagType {
  switch (severity) {
    case FineSeverity.LIGHT:
      return PoTagType.Success;
    case FineSeverity.MEDIUM:
      return PoTagType.Info;
    case FineSeverity.SERIOUS:
      return PoTagType.Warning;
    case FineSeverity.VERY_SERIOUS:
      return PoTagType.Danger;
    default:
      return PoTagType.Neutral;
  }
}

export function formatFineDate(isoDate: string): string {
  if (!isoDate) return '—';
  const date = new Date(isoDate);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatFineAmount(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatFinePoints(points: number): string {
  return `${points} pt${points !== 1 ? 's' : ''}`;
}

export function formatDriverLabel(driver: { name: string; cpf: string } | null): string {
  if (!driver) return 'Não identificado';
  return driver.name;
}

export function isDueDateOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date();
}
