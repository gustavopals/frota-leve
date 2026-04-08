import { DocumentStatus, VehicleStatus, type Prisma } from '@frota-leve/database';
import {
  formatPlate,
  type DashboardAlertItem,
  type DashboardCostBreakdown,
  type DashboardMonthlyCostItem,
  type DashboardRecentActivityItem,
  type DashboardSummaryResponse,
} from '@frota-leve/shared';
import { prisma } from '../../config/database';
import {
  DOCUMENT_CRITICAL_ALERT_DAYS,
  getDaysUntilExpiration,
  refreshDocumentStatuses,
} from '../documents/documents.alerts';
import type { DashboardActorContext } from './dashboard.types';

const DASHBOARD_ACTIVITY_LIMIT = 10;
const DASHBOARD_ALERT_LIMIT = 8;
const CNH_ALERT_WINDOW_DAYS = 30;
const CRITICAL_CNH_ALERT_DAYS = 7;
const DASHBOARD_MONTHS_WINDOW = 6;

type DashboardAuditLogRecord = Prisma.AuditLogGetPayload<{
  select: {
    id: true;
    action: true;
    entity: true;
    entityId: true;
    userId: true;
    changes: true;
    createdAt: true;
  };
}>;

type DashboardDriverAlertRecord = Prisma.DriverGetPayload<{
  select: {
    id: true;
    name: true;
    cnhCategory: true;
    cnhExpiration: true;
  };
}>;

type DashboardVehicleAlertRecord = Prisma.VehicleGetPayload<{
  select: {
    id: true;
    plate: true;
    brand: true;
    model: true;
    updatedAt: true;
  };
}>;

type DashboardDocumentAlertRecord = Prisma.DocumentGetPayload<{
  select: {
    id: true;
    type: true;
    description: true;
    expirationDate: true;
    status: true;
    vehicle: {
      select: {
        id: true;
        plate: true;
        brand: true;
        model: true;
      };
    };
    driver: {
      select: {
        id: true;
        name: true;
        cpf: true;
      };
    };
  };
}>;

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function addMonths(value: Date, months: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + months, 1);
}

function formatMonthLabel(value: Date): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: '2-digit',
  });

  return formatter.format(value).replace('.', '');
}

function createEmptyCostBreakdown(): DashboardCostBreakdown {
  return {
    fuel: 0,
    maintenance: 0,
    fines: 0,
    other: 0,
    total: 0,
  };
}

function createEmptyMonthlyCostSeries(referenceDate: Date): DashboardMonthlyCostItem[] {
  return Array.from({ length: DASHBOARD_MONTHS_WINDOW }, (_, index) => {
    const monthDate = addMonths(referenceDate, index - (DASHBOARD_MONTHS_WINDOW - 1));

    return {
      month: formatMonthLabel(monthDate),
      ...createEmptyCostBreakdown(),
    };
  });
}

function calculateVariation(currentMonth: number, previousMonth: number): number {
  if (previousMonth === 0) {
    return currentMonth === 0 ? 0 : 100;
  }

  return Number((((currentMonth - previousMonth) / previousMonth) * 100).toFixed(1));
}

function mapVehicleSummaryByStatus(
  groups: Array<{
    status: VehicleStatus;
    _count: { _all: number };
  }>,
) {
  const summary = {
    total: 0,
    active: 0,
    maintenance: 0,
    reserve: 0,
    decommissioned: 0,
    incident: 0,
  };

  for (const group of groups) {
    summary.total += group._count._all;

    switch (group.status) {
      case VehicleStatus.ACTIVE:
        summary.active = group._count._all;
        break;
      case VehicleStatus.MAINTENANCE:
        summary.maintenance = group._count._all;
        break;
      case VehicleStatus.RESERVE:
        summary.reserve = group._count._all;
        break;
      case VehicleStatus.DECOMMISSIONED:
        summary.decommissioned = group._count._all;
        break;
      case VehicleStatus.INCIDENT:
        summary.incident = group._count._all;
        break;
    }
  }

  return summary;
}

function getActivityLink(entity: string, entityId: string): string | null {
  if (entity === 'Vehicle') {
    return `/vehicles/${entityId}`;
  }

  if (entity === 'Driver') {
    return `/drivers/${entityId}`;
  }

  if (entity === 'Document') {
    return '/documents';
  }

  return null;
}

function formatDocumentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    IPVA: 'IPVA',
    LICENSING: 'Licenciamento',
    INSURANCE: 'Seguro',
    CNH: 'CNH',
    ANTT: 'ANTT/RNTRC',
    AET: 'AET',
    MOPP: 'MOPP',
    INSPECTION: 'Inspeção',
    OTHER: 'Documento',
  };

  return labels[type] ?? type;
}

function coerceRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function describeActivity(log: DashboardAuditLogRecord): string {
  const changes = coerceRecord(log.changes);
  const after = changes?.['after'];
  const afterRecord =
    after && typeof after === 'object' && !Array.isArray(after)
      ? (after as Record<string, unknown>)
      : null;

  switch (log.action) {
    case 'VEHICLE_CREATED':
      return `Veículo ${typeof afterRecord?.['plate'] === 'string' ? formatPlate(afterRecord['plate']) : 'novo'} cadastrado na frota.`;
    case 'VEHICLE_UPDATED':
      return 'Cadastro do veículo atualizado para refletir a operação atual.';
    case 'VEHICLE_STATUS_CHANGED':
      return 'Status operacional de um veículo foi alterado.';
    case 'VEHICLE_MILEAGE_UPDATED':
      return 'Quilometragem do veículo atualizada.';
    case 'VEHICLE_IMPORTED':
      return `Veículo importado em lote${typeof changes?.['row'] === 'number' ? ` (linha ${changes['row']})` : ''}.`;
    case 'DRIVER_CREATED':
      return `Motorista ${typeof afterRecord?.['name'] === 'string' ? afterRecord['name'] : 'novo'} cadastrado.`;
    case 'DRIVER_UPDATED':
      return 'Ficha do motorista atualizada.';
    case 'DRIVER_IMPORTED':
      return `Motorista importado em lote${typeof changes?.['row'] === 'number' ? ` (linha ${changes['row']})` : ''}.`;
    case 'DRIVER_VEHICLE_LINKED':
      return `Motorista vinculado ao veículo ${typeof changes?.['vehiclePlate'] === 'string' ? formatPlate(changes['vehiclePlate']) : 'selecionado'}.`;
    case 'DRIVER_DELETED':
      return 'Perfil do motorista foi desativado.';
    case 'DOCUMENT_CREATED':
      return `Documento ${typeof afterRecord?.['type'] === 'string' ? formatDocumentTypeLabel(afterRecord['type']) : 'novo'} cadastrado.`;
    case 'DOCUMENT_UPDATED':
      return 'Cadastro do documento foi atualizado.';
    case 'DOCUMENT_DELETED':
      return 'Documento removido do controle da frota.';
    case 'DOCUMENT_EXPIRING':
      return 'Alerta automático de documento próximo do vencimento foi gerado.';
    case 'DOCUMENT_EXPIRED':
      return 'Alerta automático de documento vencido foi gerado.';
    default:
      return `${log.entity} recebeu uma atualização auditada.`;
  }
}

function toRecentActivity(
  logs: DashboardAuditLogRecord[],
  userNameById: Map<string, string>,
): DashboardRecentActivityItem[] {
  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    actorName: log.userId ? (userNameById.get(log.userId) ?? null) : null,
    description: describeActivity(log),
    occurredAt: log.createdAt.toISOString(),
    link: getActivityLink(log.entity, log.entityId),
  }));
}

function toDriverCnhAlert(driver: DashboardDriverAlertRecord, today: Date): DashboardAlertItem {
  const expiration = driver.cnhExpiration;
  const diffDays = expiration
    ? Math.ceil((expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : CNH_ALERT_WINDOW_DAYS;
  const severity = diffDays <= CRITICAL_CNH_ALERT_DAYS ? 'high' : 'medium';

  return {
    id: `driver-cnh-${driver.id}`,
    type: 'driver_cnh_expiring',
    severity,
    title: `CNH de ${driver.name} vence em breve`,
    description: `${driver.cnhCategory ? `Categoria ${driver.cnhCategory}` : 'CNH sem categoria informada'} • validade em ${expiration ? expiration.toLocaleDateString('pt-BR') : 'data não informada'}.`,
    dueAt: expiration?.toISOString() ?? null,
    link: `/drivers/${driver.id}`,
  };
}

function toVehicleMaintenanceAlert(vehicle: DashboardVehicleAlertRecord): DashboardAlertItem {
  return {
    id: `vehicle-maintenance-${vehicle.id}`,
    type: 'maintenance_due',
    severity: 'medium',
    title: `${formatPlate(vehicle.plate)} exige acompanhamento`,
    description: `${vehicle.brand} ${vehicle.model} está em manutenção no momento.`,
    dueAt: vehicle.updatedAt.toISOString(),
    link: `/vehicles/${vehicle.id}`,
  };
}

function toDocumentAlert(document: DashboardDocumentAlertRecord, today: Date): DashboardAlertItem {
  const daysUntilExpiration = getDaysUntilExpiration(document.expirationDate, today);
  const severity =
    document.status === DocumentStatus.EXPIRED ||
    daysUntilExpiration <= DOCUMENT_CRITICAL_ALERT_DAYS
      ? 'high'
      : 'medium';
  const targetParts: string[] = [];

  if (document.vehicle) {
    targetParts.push(`Veículo ${formatPlate(document.vehicle.plate)}`);
  }

  if (document.driver) {
    targetParts.push(`Motorista ${document.driver.name}`);
  }

  return {
    id: `document-${document.id}`,
    type: 'documents_expiring',
    severity,
    title:
      document.status === DocumentStatus.EXPIRED
        ? `${formatDocumentTypeLabel(document.type)} vencido`
        : `${formatDocumentTypeLabel(document.type)} vence em breve`,
    description: `${document.description} • ${targetParts.join(' • ') || 'Sem vínculo definido'} • vencimento em ${document.expirationDate.toLocaleDateString('pt-BR')}.`,
    dueAt: document.expirationDate.toISOString(),
    link: '/documents',
  };
}

function compareAlerts(a: DashboardAlertItem, b: DashboardAlertItem): number {
  const severityWeight = {
    high: 3,
    medium: 2,
    low: 1,
  };

  if (severityWeight[a.severity] !== severityWeight[b.severity]) {
    return severityWeight[b.severity] - severityWeight[a.severity];
  }

  if (!a.dueAt && !b.dueAt) {
    return 0;
  }

  if (!a.dueAt) {
    return 1;
  }

  if (!b.dueAt) {
    return -1;
  }

  return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
}

export class DashboardService {
  async getSummary(context: DashboardActorContext): Promise<DashboardSummaryResponse> {
    const today = startOfDay(new Date());
    const cnhAlertThreshold = addDays(today, CNH_ALERT_WINDOW_DAYS);

    await refreshDocumentStatuses(prisma, context.tenantId);

    const [
      vehicleStatusGroups,
      vehiclesInMaintenance,
      totalDrivers,
      activeDrivers,
      cnhExpiringDriversCount,
      cnhExpiringDrivers,
      documentsExpiringCount,
      documentsExpiring,
      auditLogs,
    ] = await Promise.all([
      prisma.vehicle.groupBy({
        by: ['status'],
        where: {
          tenantId: context.tenantId,
        },
        _count: {
          _all: true,
        },
      }),
      prisma.vehicle.findMany({
        where: {
          tenantId: context.tenantId,
          status: VehicleStatus.MAINTENANCE,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: DASHBOARD_ALERT_LIMIT,
        select: {
          id: true,
          plate: true,
          brand: true,
          model: true,
          updatedAt: true,
        },
      }),
      prisma.driver.count({
        where: {
          tenantId: context.tenantId,
        },
      }),
      prisma.driver.count({
        where: {
          tenantId: context.tenantId,
          isActive: true,
        },
      }),
      prisma.driver.count({
        where: {
          tenantId: context.tenantId,
          cnhExpiration: {
            gte: today,
            lte: cnhAlertThreshold,
          },
        },
      }),
      prisma.driver.findMany({
        where: {
          tenantId: context.tenantId,
          cnhExpiration: {
            gte: today,
            lte: cnhAlertThreshold,
          },
        },
        orderBy: {
          cnhExpiration: 'asc',
        },
        take: DASHBOARD_ALERT_LIMIT,
        select: {
          id: true,
          name: true,
          cnhCategory: true,
          cnhExpiration: true,
        },
      }),
      prisma.document.count({
        where: {
          tenantId: context.tenantId,
          status: {
            in: [DocumentStatus.EXPIRING, DocumentStatus.EXPIRED],
          },
        },
      }),
      prisma.document.findMany({
        where: {
          tenantId: context.tenantId,
          status: {
            in: [DocumentStatus.EXPIRING, DocumentStatus.EXPIRED],
          },
        },
        orderBy: {
          expirationDate: 'asc',
        },
        take: DASHBOARD_ALERT_LIMIT,
        select: {
          id: true,
          type: true,
          description: true,
          expirationDate: true,
          status: true,
          vehicle: {
            select: {
              id: true,
              plate: true,
              brand: true,
              model: true,
            },
          },
          driver: {
            select: {
              id: true,
              name: true,
              cpf: true,
            },
          },
        },
      }),
      prisma.auditLog.findMany({
        where: {
          tenantId: context.tenantId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: DASHBOARD_ACTIVITY_LIMIT,
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          userId: true,
          changes: true,
          createdAt: true,
        },
      }),
    ]);

    const vehicleSummary = mapVehicleSummaryByStatus(vehicleStatusGroups);
    const userIds = Array.from(
      new Set(auditLogs.map((log) => log.userId).filter((id): id is string => Boolean(id))),
    );
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: {
              tenantId: context.tenantId,
              id: {
                in: userIds,
              },
            },
            select: {
              id: true,
              name: true,
            },
          })
        : [];

    const userNameById = new Map(users.map((user) => [user.id, user.name]));
    const alertItems = [
      ...documentsExpiring.map((document) => toDocumentAlert(document, today)),
      ...cnhExpiringDrivers.map((driver) => toDriverCnhAlert(driver, today)),
      ...vehiclesInMaintenance.map(toVehicleMaintenanceAlert),
    ]
      .sort(compareAlerts)
      .slice(0, DASHBOARD_ALERT_LIMIT);

    const monthlySeries = createEmptyMonthlyCostSeries(today);
    const currentMonthCosts = monthlySeries[monthlySeries.length - 1] ?? {
      month: formatMonthLabel(today),
      ...createEmptyCostBreakdown(),
    };
    const previousMonthCosts = monthlySeries[monthlySeries.length - 2] ?? {
      month: formatMonthLabel(addMonths(today, -1)),
      ...createEmptyCostBreakdown(),
    };

    return {
      generatedAt: new Date().toISOString(),
      vehicles: vehicleSummary,
      drivers: {
        total: totalDrivers,
        active: activeDrivers,
        cnhExpiring: cnhExpiringDriversCount,
      },
      alerts: {
        maintenanceDue: vehicleSummary.maintenance,
        documentsExpiring: documentsExpiringCount,
        pendingFines: 0,
        cnhExpiring: cnhExpiringDriversCount,
        totalPending: vehicleSummary.maintenance + documentsExpiringCount + cnhExpiringDriversCount,
        items: alertItems,
      },
      costs: {
        currentMonth: currentMonthCosts.total,
        previousMonth: previousMonthCosts.total,
        variation: calculateVariation(currentMonthCosts.total, previousMonthCosts.total),
        breakdownCurrentMonth: createEmptyCostBreakdown(),
        breakdownPreviousMonth: createEmptyCostBreakdown(),
        monthlySeries,
      },
      recentActivity: toRecentActivity(auditLogs, userNameById),
    };
  }
}

export const dashboardService = new DashboardService();
