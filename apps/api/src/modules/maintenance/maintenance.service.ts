import { Prisma } from '@frota-leve/database';
import type {
  MaintenanceType as DatabaseMaintenanceType,
  ServiceOrderStatus as DatabaseServiceOrderStatus,
} from '@frota-leve/database';
import { prisma } from '../../config/database';
import { NotFoundError, ValidationError } from '../../shared/errors';
import type {
  MaintenanceAlertItem,
  MaintenanceAlertsResponse,
  MaintenanceActorContext,
  MaintenanceCostsResponse,
  MaintenanceCostGranularity,
  MaintenanceCostVehicleItem,
  MaintenancePlanDeletionResult,
  MaintenancePlanDueReason,
  MaintenancePlanListResponse,
  MaintenanceReliabilityItem,
  MaintenanceStatsResponse,
  MaintenancePlanWithVehicle,
} from './maintenance.types';
import type {
  MaintenanceAlertsQueryInput,
  MaintenancePlanCreateInput,
  MaintenancePlanListQueryInput,
  MaintenancePlanReplaceInput,
  MaintenanceStatsQueryInput,
} from './maintenance.validators';

const MAINTENANCE_PLAN_ENTITY = 'MaintenancePlan';

const maintenanceVehicleSelect = {
  id: true,
  plate: true,
  brand: true,
  model: true,
  year: true,
  currentMileage: true,
  status: true,
} satisfies Prisma.VehicleSelect;

const maintenancePlanInclude = {
  vehicle: {
    select: maintenanceVehicleSelect,
  },
} satisfies Prisma.MaintenancePlanInclude;

const maintenanceReliabilityOrderSelect = {
  vehicleId: true,
  startDate: true,
  endDate: true,
  vehicle: {
    select: maintenanceVehicleSelect,
  },
} satisfies Prisma.ServiceOrderSelect;

const maintenanceCostOrderSelect = {
  vehicleId: true,
  type: true,
  totalCost: true,
  laborCost: true,
  partsCost: true,
  createdAt: true,
  vehicle: {
    select: maintenanceVehicleSelect,
  },
} satisfies Prisma.ServiceOrderSelect;

type MaintenancePlanRecord = Prisma.MaintenancePlanGetPayload<{
  include: typeof maintenancePlanInclude;
}>;

type MaintenanceReliabilityOrderRecord = Prisma.ServiceOrderGetPayload<{
  select: typeof maintenanceReliabilityOrderSelect;
}>;

type CompletedMaintenanceReliabilityOrderRecord = MaintenanceReliabilityOrderRecord & {
  startDate: Date;
  endDate: Date;
};

type MaintenanceCostOrderRecord = Prisma.ServiceOrderGetPayload<{
  select: typeof maintenanceCostOrderSelect;
}>;

type MaintenancePlanMutationInput = MaintenancePlanCreateInput | MaintenancePlanReplaceInput;

function toAuditChanges(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value == null) {
    return Prisma.JsonNull;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function differenceInHours(startDate: Date, endDate: Date): number {
  return (endDate.getTime() - startDate.getTime()) / (60 * 60 * 1000);
}

function differenceInDays(startDate: Date, endDate: Date): number {
  return Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
}

function formatPeriodKey(date: Date, granularity: MaintenanceCostGranularity): string {
  const isoDate = date.toISOString();
  return granularity === 'day' ? isoDate.slice(0, 10) : isoDate.slice(0, 7);
}

function getCostGranularity(
  dateFrom: Date | undefined,
  dateTo: Date | undefined,
  orders: MaintenanceCostOrderRecord[],
): MaintenanceCostGranularity {
  if (dateFrom && dateTo) {
    return differenceInDays(dateFrom, dateTo) <= 45 ? 'day' : 'month';
  }

  if (orders.length >= 2) {
    return differenceInDays(orders[0].createdAt, orders[orders.length - 1].createdAt) <= 45
      ? 'day'
      : 'month';
  }

  return 'month';
}

function createEmptyCostSummary() {
  return {
    totalOrders: 0,
    totalCost: 0,
    laborCost: 0,
    partsCost: 0,
  };
}

function toCostTypeKey(type: DatabaseMaintenanceType): keyof MaintenanceCostsResponse['byType'] {
  if (type === 'PREVENTIVE') {
    return 'preventive';
  }

  if (type === 'CORRECTIVE') {
    return 'corrective';
  }

  return 'predictive';
}

function calculateRemainingDays(nextDueAt: Date | null, referenceDate: Date): number | null {
  if (!nextDueAt) {
    return null;
  }

  const diffMs = nextDueAt.getTime() - referenceDate.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

function calculateRemainingKm(
  nextDueMileage: number | null,
  currentMileage: number,
): number | null {
  if (nextDueMileage === null) {
    return null;
  }

  return nextDueMileage - currentMileage;
}

function toDatabaseMaintenanceType(
  value: MaintenancePlanMutationInput['type'],
): DatabaseMaintenanceType {
  return value as unknown as DatabaseMaintenanceType;
}

function resolveNextDueAt(input: MaintenancePlanMutationInput): Date | null {
  if (input.nextDueAt) {
    return input.nextDueAt;
  }

  if (input.lastExecutedAt && input.intervalDays !== undefined) {
    return addDays(input.lastExecutedAt, input.intervalDays);
  }

  return null;
}

function resolveNextDueMileage(input: MaintenancePlanMutationInput): number | null {
  if (input.nextDueMileage !== undefined) {
    return input.nextDueMileage;
  }

  if (input.lastExecutedMileage !== undefined && input.intervalKm !== undefined) {
    return input.lastExecutedMileage + input.intervalKm;
  }

  return null;
}

async function findVehicleOrThrow(tenantId: string, vehicleId: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenantId },
    select: {
      id: true,
      currentMileage: true,
    },
  });

  if (!vehicle) {
    throw new NotFoundError('Veículo não encontrado');
  }

  return vehicle;
}

function validateScheduleInput(input: MaintenancePlanMutationInput, currentMileage: number): void {
  if (input.intervalDays !== undefined && !input.lastExecutedAt && !input.nextDueAt) {
    throw new ValidationError(
      'Informe a última execução ou a próxima data para usar intervalo em dias',
    );
  }

  if (
    input.intervalKm !== undefined &&
    input.lastExecutedMileage === undefined &&
    input.nextDueMileage === undefined
  ) {
    throw new ValidationError(
      'Informe a última execução ou a próxima quilometragem para usar intervalo em km',
    );
  }

  if (input.lastExecutedMileage !== undefined && input.lastExecutedMileage > currentMileage) {
    throw new ValidationError(
      `Quilometragem da última execução (${input.lastExecutedMileage} km) não pode ser maior que a quilometragem atual do veículo (${currentMileage} km)`,
    );
  }

  if (
    input.lastExecutedAt &&
    input.nextDueAt &&
    input.nextDueAt.getTime() < input.lastExecutedAt.getTime()
  ) {
    throw new ValidationError(
      'A próxima data de vencimento não pode ser anterior à última execução',
    );
  }

  if (
    input.lastExecutedMileage !== undefined &&
    input.nextDueMileage !== undefined &&
    input.nextDueMileage < input.lastExecutedMileage
  ) {
    throw new ValidationError('A próxima quilometragem não pode ser menor que a última execução');
  }
}

function getDueReasons(
  record: MaintenancePlanRecord,
  referenceDate: Date = new Date(),
): MaintenancePlanDueReason[] {
  if (!record.isActive) {
    return [];
  }

  const reasons: MaintenancePlanDueReason[] = [];

  if (record.nextDueAt && record.nextDueAt.getTime() <= referenceDate.getTime()) {
    reasons.push('date');
  }

  if (record.nextDueMileage !== null && record.vehicle.currentMileage >= record.nextDueMileage) {
    reasons.push('mileage');
  }

  return reasons;
}

function getUpcomingReasons(
  record: MaintenancePlanRecord,
  referenceDate: Date,
  daysAhead: number,
  kmAhead: number,
): MaintenancePlanDueReason[] {
  if (!record.isActive) {
    return [];
  }

  if (getDueReasons(record, referenceDate).length > 0) {
    return [];
  }

  const reasons: MaintenancePlanDueReason[] = [];
  const dueDateThreshold = addDays(referenceDate, daysAhead);

  if (record.nextDueAt && record.nextDueAt.getTime() <= dueDateThreshold.getTime()) {
    reasons.push('date');
  }

  if (
    record.nextDueMileage !== null &&
    record.nextDueMileage - record.vehicle.currentMileage <= kmAhead
  ) {
    reasons.push('mileage');
  }

  return reasons;
}

function compareAlertUrgency(a: MaintenanceAlertItem, b: MaintenanceAlertItem): number {
  if (a.alertType !== b.alertType) {
    return a.alertType === 'overdue' ? -1 : 1;
  }

  const dayA = a.remainingDays ?? Number.POSITIVE_INFINITY;
  const dayB = b.remainingDays ?? Number.POSITIVE_INFINITY;

  if (dayA !== dayB) {
    return dayA - dayB;
  }

  const kmA = a.remainingKm ?? Number.POSITIVE_INFINITY;
  const kmB = b.remainingKm ?? Number.POSITIVE_INFINITY;

  if (kmA !== kmB) {
    return kmA - kmB;
  }

  return a.name.localeCompare(b.name);
}

function hasCompletedDates(
  order: MaintenanceReliabilityOrderRecord,
): order is CompletedMaintenanceReliabilityOrderRecord {
  return order.startDate !== null && order.endDate !== null;
}

export class MaintenanceService {
  async getMaintenanceAlerts(
    context: MaintenanceActorContext,
    query: MaintenanceAlertsQueryInput,
  ): Promise<MaintenanceAlertsResponse> {
    const { tenantId } = context;
    const { vehicleId, daysAhead, kmAhead, limit } = query;
    const referenceDate = new Date();

    const plans = await prisma.maintenancePlan.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(vehicleId ? { vehicleId } : {}),
        OR: [{ nextDueAt: { not: null } }, { nextDueMileage: { not: null } }],
      },
      include: maintenancePlanInclude,
    });

    const items = plans
      .reduce<MaintenanceAlertItem[]>((acc, plan) => {
        if (vehicleId && plan.vehicleId !== vehicleId) {
          return acc;
        }

        const dueReasons = getDueReasons(plan, referenceDate);
        const upcomingReasons =
          dueReasons.length > 0 ? [] : getUpcomingReasons(plan, referenceDate, daysAhead, kmAhead);
        const alertType =
          dueReasons.length > 0 ? 'overdue' : upcomingReasons.length > 0 ? 'upcoming' : null;
        const reasons = dueReasons.length > 0 ? dueReasons : upcomingReasons;

        if (!alertType || reasons.length === 0) {
          return acc;
        }

        acc.push({
          id: plan.id,
          tenantId: plan.tenantId,
          vehicleId: plan.vehicleId,
          name: plan.name,
          type: plan.type,
          alertType,
          dueReasons: reasons,
          nextDueAt: plan.nextDueAt,
          nextDueMileage: plan.nextDueMileage,
          currentMileage: plan.vehicle.currentMileage,
          remainingDays: calculateRemainingDays(plan.nextDueAt, referenceDate),
          remainingKm: calculateRemainingKm(plan.nextDueMileage, plan.vehicle.currentMileage),
          vehicle: plan.vehicle,
        });

        return acc;
      }, [])
      .sort(compareAlertUrgency)
      .slice(0, limit);

    const overdue = items.filter((item) => item.alertType === 'overdue').length;
    const upcoming = items.filter((item) => item.alertType === 'upcoming').length;

    return {
      items,
      summary: {
        overdue,
        upcoming,
        total: items.length,
        daysAhead,
        kmAhead,
      },
    };
  }

  async getMaintenanceStats(
    context: MaintenanceActorContext,
    query: MaintenanceStatsQueryInput,
  ): Promise<MaintenanceStatsResponse> {
    const { tenantId } = context;
    const { vehicleId, dateFrom, dateTo } = query;

    const completedAtFilter = {
      not: null,
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };

    const createdAtFilter = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };

    const [reliabilityOrders, costOrders] = await Promise.all([
      prisma.serviceOrder.findMany({
        where: {
          tenantId,
          ...(vehicleId ? { vehicleId } : {}),
          type: 'CORRECTIVE' as DatabaseMaintenanceType,
          status: 'COMPLETED' as DatabaseServiceOrderStatus,
          startDate: { not: null },
          endDate: completedAtFilter,
        },
        select: maintenanceReliabilityOrderSelect,
        orderBy: [{ vehicleId: 'asc' }, { startDate: 'asc' }],
      }),
      prisma.serviceOrder.findMany({
        where: {
          tenantId,
          ...(vehicleId ? { vehicleId } : {}),
          status: {
            not: 'CANCELLED' as DatabaseServiceOrderStatus,
          },
          ...(dateFrom || dateTo
            ? {
                createdAt: createdAtFilter,
              }
            : {}),
        },
        select: maintenanceCostOrderSelect,
        orderBy: [{ createdAt: 'asc' }, { vehicleId: 'asc' }],
      }),
    ]);

    const groupedReliabilityOrders = reliabilityOrders
      .filter(hasCompletedDates)
      .reduce<Map<string, CompletedMaintenanceReliabilityOrderRecord[]>>((acc, order) => {
        const vehicleOrders = acc.get(order.vehicleId) ?? [];
        vehicleOrders.push(order);
        acc.set(order.vehicleId, vehicleOrders);
        return acc;
      }, new Map());

    const reliabilityItems = Array.from(groupedReliabilityOrders.values())
      .map((vehicleOrders): MaintenanceReliabilityItem => {
        const sortedOrders = [...vehicleOrders].sort(
          (left, right) => left.startDate.getTime() - right.startDate.getTime(),
        );

        let totalDowntimeHours = 0;
        let totalOperatingHours = 0;

        sortedOrders.forEach((order, index) => {
          totalDowntimeHours += differenceInHours(order.startDate, order.endDate);

          if (index === 0) {
            return;
          }

          const previousOrder = sortedOrders[index - 1];
          const uptimeHours = Math.max(
            0,
            differenceInHours(previousOrder.endDate, order.startDate),
          );

          totalOperatingHours += uptimeHours;
        });

        const correctiveOrders = sortedOrders.length;
        const operatingIntervals = Math.max(correctiveOrders - 1, 0);
        const firstVehicle = sortedOrders[0]?.vehicle;
        const lastOrder = sortedOrders[correctiveOrders - 1] ?? null;

        return {
          vehicle: firstVehicle,
          correctiveOrders,
          totalDowntimeHours: roundToTwoDecimals(totalDowntimeHours),
          totalOperatingHours:
            operatingIntervals > 0 ? roundToTwoDecimals(totalOperatingHours) : null,
          mttrHours: roundToTwoDecimals(totalDowntimeHours / correctiveOrders),
          mtbfHours:
            operatingIntervals > 0
              ? roundToTwoDecimals(totalOperatingHours / operatingIntervals)
              : null,
          lastRepairStartedAt: lastOrder?.startDate ?? null,
          lastRepairCompletedAt: lastOrder?.endDate ?? null,
        };
      })
      .sort((left, right) => left.vehicle.plate.localeCompare(right.vehicle.plate));

    const totalCorrectiveOrders = reliabilityItems.reduce(
      (sum, item) => sum + item.correctiveOrders,
      0,
    );
    const totalDowntimeHours = reliabilityItems.reduce(
      (sum, item) => sum + item.totalDowntimeHours,
      0,
    );
    const totalOperatingHours = reliabilityItems.reduce(
      (sum, item) => sum + (item.totalOperatingHours ?? 0),
      0,
    );
    const totalOperatingIntervals = reliabilityItems.reduce(
      (sum, item) => sum + Math.max(item.correctiveOrders - 1, 0),
      0,
    );

    const granularity = getCostGranularity(dateFrom, dateTo, costOrders);
    const byType: MaintenanceCostsResponse['byType'] = {
      preventive: createEmptyCostSummary(),
      corrective: createEmptyCostSummary(),
      predictive: createEmptyCostSummary(),
    };
    const byVehicleMap = new Map<string, MaintenanceCostVehicleItem>();
    const byPeriodMap = new Map<string, MaintenanceCostsResponse['byPeriod'][number]>();

    for (const order of costOrders) {
      const typeKey = toCostTypeKey(order.type);
      const totalCost = order.totalCost;
      const laborCost = order.laborCost ?? 0;
      const partsCost = order.partsCost ?? 0;
      const vehicleEntry = byVehicleMap.get(order.vehicleId) ?? {
        vehicle: order.vehicle,
        totalOrders: 0,
        totalCost: 0,
        laborCost: 0,
        partsCost: 0,
        preventiveCost: 0,
        correctiveCost: 0,
        predictiveCost: 0,
      };
      const periodKey = formatPeriodKey(order.createdAt, granularity);
      const periodEntry = byPeriodMap.get(periodKey) ?? {
        period: periodKey,
        label: periodKey,
        totalOrders: 0,
        totalCost: 0,
        laborCost: 0,
        partsCost: 0,
        preventiveCost: 0,
        correctiveCost: 0,
        predictiveCost: 0,
      };

      byType[typeKey].totalOrders += 1;
      byType[typeKey].totalCost += totalCost;
      byType[typeKey].laborCost += laborCost;
      byType[typeKey].partsCost += partsCost;

      vehicleEntry.totalOrders += 1;
      vehicleEntry.totalCost += totalCost;
      vehicleEntry.laborCost += laborCost;
      vehicleEntry.partsCost += partsCost;
      if (typeKey === 'preventive') {
        vehicleEntry.preventiveCost += totalCost;
      } else if (typeKey === 'corrective') {
        vehicleEntry.correctiveCost += totalCost;
      } else {
        vehicleEntry.predictiveCost += totalCost;
      }

      periodEntry.totalOrders += 1;
      periodEntry.totalCost += totalCost;
      periodEntry.laborCost += laborCost;
      periodEntry.partsCost += partsCost;
      if (typeKey === 'preventive') {
        periodEntry.preventiveCost += totalCost;
      } else if (typeKey === 'corrective') {
        periodEntry.correctiveCost += totalCost;
      } else {
        periodEntry.predictiveCost += totalCost;
      }

      byVehicleMap.set(order.vehicleId, vehicleEntry);
      byPeriodMap.set(periodKey, periodEntry);
    }

    const totalOrders = costOrders.length;
    const totalCost = costOrders.reduce((sum, order) => sum + order.totalCost, 0);
    const totalLaborCost = costOrders.reduce((sum, order) => sum + (order.laborCost ?? 0), 0);
    const totalPartsCost = costOrders.reduce((sum, order) => sum + (order.partsCost ?? 0), 0);

    const costs: MaintenanceCostsResponse = {
      summary: {
        totalOrders,
        totalCost: roundToTwoDecimals(totalCost),
        laborCost: roundToTwoDecimals(totalLaborCost),
        partsCost: roundToTwoDecimals(totalPartsCost),
        averageOrderCost: totalOrders > 0 ? roundToTwoDecimals(totalCost / totalOrders) : null,
        preventiveCost: roundToTwoDecimals(byType.preventive.totalCost),
        correctiveCost: roundToTwoDecimals(byType.corrective.totalCost),
        predictiveCost: roundToTwoDecimals(byType.predictive.totalCost),
        dateFrom: dateFrom ?? null,
        dateTo: dateTo ?? null,
        granularity,
      },
      byType: {
        preventive: {
          totalOrders: byType.preventive.totalOrders,
          totalCost: roundToTwoDecimals(byType.preventive.totalCost),
          laborCost: roundToTwoDecimals(byType.preventive.laborCost),
          partsCost: roundToTwoDecimals(byType.preventive.partsCost),
        },
        corrective: {
          totalOrders: byType.corrective.totalOrders,
          totalCost: roundToTwoDecimals(byType.corrective.totalCost),
          laborCost: roundToTwoDecimals(byType.corrective.laborCost),
          partsCost: roundToTwoDecimals(byType.corrective.partsCost),
        },
        predictive: {
          totalOrders: byType.predictive.totalOrders,
          totalCost: roundToTwoDecimals(byType.predictive.totalCost),
          laborCost: roundToTwoDecimals(byType.predictive.laborCost),
          partsCost: roundToTwoDecimals(byType.predictive.partsCost),
        },
      },
      byVehicle: Array.from(byVehicleMap.values())
        .map((item) => ({
          ...item,
          totalCost: roundToTwoDecimals(item.totalCost),
          laborCost: roundToTwoDecimals(item.laborCost),
          partsCost: roundToTwoDecimals(item.partsCost),
          preventiveCost: roundToTwoDecimals(item.preventiveCost),
          correctiveCost: roundToTwoDecimals(item.correctiveCost),
          predictiveCost: roundToTwoDecimals(item.predictiveCost),
        }))
        .sort((left, right) => right.totalCost - left.totalCost),
      byPeriod: Array.from(byPeriodMap.values())
        .map((item) => ({
          ...item,
          totalCost: roundToTwoDecimals(item.totalCost),
          laborCost: roundToTwoDecimals(item.laborCost),
          partsCost: roundToTwoDecimals(item.partsCost),
          preventiveCost: roundToTwoDecimals(item.preventiveCost),
          correctiveCost: roundToTwoDecimals(item.correctiveCost),
          predictiveCost: roundToTwoDecimals(item.predictiveCost),
        }))
        .sort((left, right) => left.period.localeCompare(right.period)),
    };

    return {
      reliability: {
        items: reliabilityItems,
        summary: {
          totalVehicles: reliabilityItems.length,
          totalCorrectiveOrders,
          vehiclesWithMtbf: reliabilityItems.filter((item) => item.mtbfHours !== null).length,
          averageMttrHours:
            totalCorrectiveOrders > 0
              ? roundToTwoDecimals(totalDowntimeHours / totalCorrectiveOrders)
              : null,
          averageMtbfHours:
            totalOperatingIntervals > 0
              ? roundToTwoDecimals(totalOperatingHours / totalOperatingIntervals)
              : null,
          totalDowntimeHours: roundToTwoDecimals(totalDowntimeHours),
          totalOperatingHours: roundToTwoDecimals(totalOperatingHours),
          dateFrom: dateFrom ?? null,
          dateTo: dateTo ?? null,
        },
      },
      costs,
    };
  }

  async listMaintenancePlans(
    context: MaintenanceActorContext,
    query: MaintenancePlanListQueryInput,
  ): Promise<MaintenancePlanListResponse<MaintenancePlanWithVehicle>> {
    const { tenantId } = context;
    const { vehicleId, type, isActive, search, page, pageSize, sortBy, sortOrder } = query;

    const where: Prisma.MaintenancePlanWhereInput = {
      tenantId,
      ...(vehicleId ? { vehicleId } : {}),
      ...(type ? { type: type as unknown as DatabaseMaintenanceType } : {}),
      ...(typeof isActive === 'boolean' ? { isActive } : {}),
      ...(search
        ? {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.maintenancePlan.findMany({
        where,
        include: maintenancePlanInclude,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.maintenancePlan.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: items.map((item) => this.toMaintenancePlanResponse(item)),
      hasNext: page < totalPages,
      meta: { page, pageSize, total, totalPages },
    };
  }

  async getMaintenancePlanById(
    context: MaintenanceActorContext,
    maintenancePlanId: string,
  ): Promise<MaintenancePlanWithVehicle> {
    const plan = await prisma.maintenancePlan.findFirst({
      where: {
        id: maintenancePlanId,
        tenantId: context.tenantId,
      },
      include: maintenancePlanInclude,
    });

    if (!plan) {
      throw new NotFoundError('Plano de manutenção não encontrado');
    }

    return this.toMaintenancePlanResponse(plan);
  }

  async createMaintenancePlan(
    context: MaintenanceActorContext,
    input: MaintenancePlanCreateInput,
  ): Promise<MaintenancePlanWithVehicle> {
    const { tenantId, userId, ipAddress, userAgent } = context;

    const vehicle = await findVehicleOrThrow(tenantId, input.vehicleId);
    validateScheduleInput(input, vehicle.currentMileage);

    const nextDueAt = resolveNextDueAt(input);
    const nextDueMileage = resolveNextDueMileage(input);

    const created = await prisma.$transaction(async (tx) => {
      const plan = await tx.maintenancePlan.create({
        data: {
          tenantId,
          vehicleId: input.vehicleId,
          name: input.name.trim(),
          type: toDatabaseMaintenanceType(input.type),
          intervalKm: input.intervalKm ?? null,
          intervalDays: input.intervalDays ?? null,
          lastExecutedAt: input.lastExecutedAt ?? null,
          lastExecutedMileage: input.lastExecutedMileage ?? null,
          nextDueAt,
          nextDueMileage,
          isActive: input.isActive ?? true,
        },
        include: maintenancePlanInclude,
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'MAINTENANCE_PLAN_CREATED',
          entity: MAINTENANCE_PLAN_ENTITY,
          entityId: plan.id,
          changes: toAuditChanges({
            vehicleId: input.vehicleId,
            name: input.name,
            type: input.type,
            intervalKm: input.intervalKm ?? null,
            intervalDays: input.intervalDays ?? null,
            nextDueAt,
            nextDueMileage,
            isActive: input.isActive ?? true,
          }),
          ipAddress,
          userAgent,
        },
      });

      return plan;
    });

    return this.toMaintenancePlanResponse(created);
  }

  async replaceMaintenancePlan(
    context: MaintenanceActorContext,
    maintenancePlanId: string,
    input: MaintenancePlanReplaceInput,
  ): Promise<MaintenancePlanWithVehicle> {
    const { tenantId, userId, ipAddress, userAgent } = context;

    const current = await prisma.maintenancePlan.findFirst({
      where: {
        id: maintenancePlanId,
        tenantId,
      },
      include: maintenancePlanInclude,
    });

    if (!current) {
      throw new NotFoundError('Plano de manutenção não encontrado');
    }

    const vehicle = await findVehicleOrThrow(tenantId, input.vehicleId);
    validateScheduleInput(input, vehicle.currentMileage);

    const nextDueAt = resolveNextDueAt(input);
    const nextDueMileage = resolveNextDueMileage(input);

    const updated = await prisma.$transaction(async (tx) => {
      const plan = await tx.maintenancePlan.update({
        where: {
          id: maintenancePlanId,
        },
        data: {
          vehicleId: input.vehicleId,
          name: input.name.trim(),
          type: toDatabaseMaintenanceType(input.type),
          intervalKm: input.intervalKm ?? null,
          intervalDays: input.intervalDays ?? null,
          lastExecutedAt: input.lastExecutedAt ?? null,
          lastExecutedMileage: input.lastExecutedMileage ?? null,
          nextDueAt,
          nextDueMileage,
          isActive: input.isActive ?? true,
        },
        include: maintenancePlanInclude,
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'MAINTENANCE_PLAN_UPDATED',
          entity: MAINTENANCE_PLAN_ENTITY,
          entityId: maintenancePlanId,
          changes: toAuditChanges({
            before: current,
            after: {
              vehicleId: input.vehicleId,
              name: input.name,
              type: input.type,
              intervalKm: input.intervalKm ?? null,
              intervalDays: input.intervalDays ?? null,
              lastExecutedAt: input.lastExecutedAt ?? null,
              lastExecutedMileage: input.lastExecutedMileage ?? null,
              nextDueAt,
              nextDueMileage,
              isActive: input.isActive ?? true,
            },
          }),
          ipAddress,
          userAgent,
        },
      });

      return plan;
    });

    return this.toMaintenancePlanResponse(updated);
  }

  async deleteMaintenancePlan(
    context: MaintenanceActorContext,
    maintenancePlanId: string,
  ): Promise<MaintenancePlanDeletionResult> {
    const { tenantId, userId, ipAddress, userAgent } = context;

    const plan = await prisma.maintenancePlan.findFirst({
      where: {
        id: maintenancePlanId,
        tenantId,
      },
      include: maintenancePlanInclude,
    });

    if (!plan) {
      throw new NotFoundError('Plano de manutenção não encontrado');
    }

    const auditCount = await prisma.auditLog.count({
      where: {
        tenantId,
        entity: MAINTENANCE_PLAN_ENTITY,
        entityId: maintenancePlanId,
      },
    });

    const shouldHardDelete = auditCount <= 1;

    if (shouldHardDelete) {
      return prisma.$transaction(async (tx) => {
        await tx.auditLog.deleteMany({
          where: {
            tenantId,
            entity: MAINTENANCE_PLAN_ENTITY,
            entityId: maintenancePlanId,
          },
        });

        await tx.maintenancePlan.delete({
          where: {
            id: maintenancePlanId,
          },
        });

        return {
          deleted: true,
          mode: 'hard',
          maintenancePlanId,
        };
      });
    }

    if (plan.isActive) {
      await prisma.$transaction(async (tx) => {
        await tx.maintenancePlan.update({
          where: {
            id: maintenancePlanId,
          },
          data: {
            isActive: false,
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId,
            userId,
            action: 'MAINTENANCE_PLAN_DELETED',
            entity: MAINTENANCE_PLAN_ENTITY,
            entityId: maintenancePlanId,
            changes: toAuditChanges({
              before: { isActive: true },
              after: { isActive: false },
            }),
            ipAddress,
            userAgent,
          },
        });
      });
    }

    return {
      deleted: true,
      mode: 'soft',
      maintenancePlanId,
    };
  }

  private toMaintenancePlanResponse(record: MaintenancePlanRecord): MaintenancePlanWithVehicle {
    const dueReasons = getDueReasons(record);

    return {
      id: record.id,
      tenantId: record.tenantId,
      vehicleId: record.vehicleId,
      name: record.name,
      type: record.type,
      intervalKm: record.intervalKm,
      intervalDays: record.intervalDays,
      lastExecutedAt: record.lastExecutedAt,
      lastExecutedMileage: record.lastExecutedMileage,
      nextDueAt: record.nextDueAt,
      nextDueMileage: record.nextDueMileage,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      isOverdue: dueReasons.length > 0,
      dueReasons,
      vehicle: record.vehicle,
    };
  }
}

export const maintenanceService = new MaintenanceService();
