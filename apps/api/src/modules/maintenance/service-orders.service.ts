import { Prisma } from '@frota-leve/database';
import type {
  MaintenanceType as DatabaseMaintenanceType,
  ServiceOrderStatus as DatabaseServiceOrderStatus,
} from '@frota-leve/database';
import { prisma } from '../../config/database';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { ServiceOrderStatus } from '@frota-leve/shared';
import type { MaintenanceType } from '@frota-leve/shared';
import type {
  MaintenanceActorContext,
  ServiceOrderDeletionResult,
  ServiceOrderListResponse,
  ServiceOrderWithRelations,
} from './maintenance.types';
import type {
  ServiceOrderCreateInput,
  ServiceOrderListQueryInput,
  ServiceOrderReplaceInput,
} from './service-orders.validators';

const SERVICE_ORDER_ENTITY = 'ServiceOrder';

const serviceOrderInclude = {
  vehicle: {
    select: {
      id: true,
      plate: true,
      brand: true,
      model: true,
      year: true,
      currentMileage: true,
      status: true,
    },
  },
  driver: {
    select: {
      id: true,
      name: true,
      cpf: true,
    },
  },
  plan: {
    select: {
      id: true,
      name: true,
      type: true,
      intervalKm: true,
      intervalDays: true,
    },
  },
  approvedByUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  createdByUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  items: {
    orderBy: {
      description: 'asc',
    },
  },
} satisfies Prisma.ServiceOrderInclude;

type ServiceOrderRecord = Prisma.ServiceOrderGetPayload<{
  include: typeof serviceOrderInclude;
}>;

type ServiceOrderMutationInput = ServiceOrderCreateInput | ServiceOrderReplaceInput;
type NormalizedServiceOrderItem = {
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  partNumber: string | null;
};

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toAuditChanges(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value == null) {
    return Prisma.JsonNull;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeOptionalString(value?: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhotos(photos?: string[]): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (!photos || photos.length === 0) {
    return Prisma.JsonNull;
  }

  return photos as Prisma.InputJsonValue;
}

function normalizeFileUrl(value?: string | null): string | null {
  return normalizeOptionalString(value);
}

function toDatabaseMaintenanceType(value: MaintenanceType): DatabaseMaintenanceType {
  return value as unknown as DatabaseMaintenanceType;
}

function toDatabaseServiceOrderStatus(value: ServiceOrderStatus): DatabaseServiceOrderStatus {
  return value as unknown as DatabaseServiceOrderStatus;
}

function normalizeItems(items: ServiceOrderMutationInput['items']): {
  normalizedItems: NormalizedServiceOrderItem[];
  itemsTotal: number;
} {
  const normalizedItems = items.map((item) => {
    const totalCost = item.totalCost ?? item.quantity * item.unitCost;

    return {
      description: item.description.trim(),
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost,
      partNumber: normalizeOptionalString(item.partNumber),
    };
  });

  const itemsTotal = normalizedItems.reduce((sum, item) => sum + item.totalCost, 0);

  return {
    normalizedItems,
    itemsTotal,
  };
}

function resolveOrderCosts(input: ServiceOrderMutationInput): {
  normalizedItems: NormalizedServiceOrderItem[];
  laborCost: number;
  partsCost: number;
  totalCost: number;
} {
  const { normalizedItems, itemsTotal } = normalizeItems(input.items);
  const laborCost = input.laborCost ?? 0;
  const partsCost = input.partsCost ?? itemsTotal;
  const totalCost = input.totalCost ?? laborCost + partsCost;

  return {
    normalizedItems,
    laborCost,
    partsCost,
    totalCost,
  };
}

function assertValidTransition(
  currentStatus: ServiceOrderStatus,
  nextStatus: ServiceOrderStatus,
): void {
  if (currentStatus === nextStatus) {
    return;
  }

  const allowedTransitions: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
    [ServiceOrderStatus.OPEN]: [ServiceOrderStatus.APPROVED, ServiceOrderStatus.CANCELLED],
    [ServiceOrderStatus.APPROVED]: [ServiceOrderStatus.IN_PROGRESS],
    [ServiceOrderStatus.IN_PROGRESS]: [ServiceOrderStatus.COMPLETED],
    [ServiceOrderStatus.COMPLETED]: [],
    [ServiceOrderStatus.CANCELLED]: [],
  };

  if (!allowedTransitions[currentStatus].includes(nextStatus)) {
    throw new ValidationError(`Transição de status inválida: ${currentStatus} → ${nextStatus}`);
  }
}

function resolveOrderDates(params: {
  currentStatus: ServiceOrderStatus;
  nextStatus: ServiceOrderStatus;
  currentStartDate: Date | null;
  currentEndDate: Date | null;
  inputStartDate?: Date;
  inputEndDate?: Date;
}): { startDate: Date | null; endDate: Date | null } {
  const {
    currentStatus,
    nextStatus,
    currentStartDate,
    currentEndDate,
    inputStartDate,
    inputEndDate,
  } = params;

  if (nextStatus === ServiceOrderStatus.OPEN) {
    return { startDate: null, endDate: null };
  }

  if (nextStatus === ServiceOrderStatus.APPROVED) {
    return { startDate: null, endDate: null };
  }

  if (nextStatus === ServiceOrderStatus.CANCELLED) {
    return { startDate: null, endDate: null };
  }

  if (nextStatus === ServiceOrderStatus.IN_PROGRESS) {
    return {
      startDate: inputStartDate ?? currentStartDate ?? new Date(),
      endDate: null,
    };
  }

  if (
    currentStatus !== ServiceOrderStatus.COMPLETED &&
    nextStatus === ServiceOrderStatus.COMPLETED
  ) {
    return {
      startDate: currentStartDate ?? inputStartDate ?? new Date(),
      endDate: inputEndDate ?? new Date(),
    };
  }

  return {
    startDate: inputStartDate ?? currentStartDate,
    endDate: inputEndDate ?? currentEndDate,
  };
}

function validateOrderDates(
  status: ServiceOrderStatus,
  startDate: Date | null,
  endDate: Date | null,
): void {
  if (
    (status === ServiceOrderStatus.OPEN ||
      status === ServiceOrderStatus.APPROVED ||
      status === ServiceOrderStatus.CANCELLED) &&
    startDate
  ) {
    throw new ValidationError('Data de início só é válida para ordens em andamento ou concluídas');
  }

  if (status !== ServiceOrderStatus.COMPLETED && endDate) {
    throw new ValidationError('Data de conclusão só é válida para ordens concluídas');
  }

  if (status === ServiceOrderStatus.IN_PROGRESS && !startDate) {
    throw new ValidationError('Ordens em andamento precisam de data de início');
  }

  if (status === ServiceOrderStatus.COMPLETED && (!startDate || !endDate)) {
    throw new ValidationError('Ordens concluídas precisam de data de início e de conclusão');
  }

  if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
    throw new ValidationError('Data de conclusão não pode ser anterior à data de início');
  }
}

async function ensureVehicleBelongsToTenant(tenantId: string, vehicleId: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      tenantId,
    },
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

async function ensureDriverBelongsToTenant(tenantId: string, driverId: string | null | undefined) {
  if (!driverId) {
    return null;
  }

  const driver = await prisma.driver.findFirst({
    where: {
      id: driverId,
      tenantId,
    },
    select: {
      id: true,
    },
  });

  if (!driver) {
    throw new NotFoundError('Motorista não encontrado');
  }

  return driver;
}

async function ensurePlanBelongsToTenant(
  tenantId: string,
  planId: string | null | undefined,
  vehicleId: string,
  type: MaintenanceType,
) {
  if (!planId) {
    return null;
  }

  const plan = await prisma.maintenancePlan.findFirst({
    where: {
      id: planId,
      tenantId,
    },
    select: {
      id: true,
      vehicleId: true,
      type: true,
      intervalKm: true,
      intervalDays: true,
    },
  });

  if (!plan) {
    throw new NotFoundError('Plano de manutenção não encontrado');
  }

  if (plan.vehicleId !== vehicleId) {
    throw new ValidationError('Plano informado não pertence ao veículo selecionado');
  }

  if (plan.type !== toDatabaseMaintenanceType(type)) {
    throw new ValidationError('Tipo da ordem de serviço deve ser compatível com o plano vinculado');
  }

  return plan;
}

export class ServiceOrdersService {
  async listServiceOrders(
    context: MaintenanceActorContext,
    query: ServiceOrderListQueryInput,
  ): Promise<ServiceOrderListResponse<ServiceOrderWithRelations>> {
    const { tenantId } = context;
    const {
      vehicleId,
      driverId,
      planId,
      type,
      status,
      search,
      dateFrom,
      dateTo,
      page,
      pageSize,
      sortBy,
      sortOrder,
    } = query;

    const where: Prisma.ServiceOrderWhereInput = {
      tenantId,
      ...(vehicleId ? { vehicleId } : {}),
      ...(driverId ? { driverId } : {}),
      ...(planId ? { planId } : {}),
      ...(type ? { type: toDatabaseMaintenanceType(type) } : {}),
      ...(status ? { status: toDatabaseServiceOrderStatus(status) } : {}),
      ...(search
        ? {
            OR: [
              { description: { contains: search, mode: 'insensitive' } },
              { workshop: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.serviceOrder.findMany({
        where,
        include: serviceOrderInclude,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.serviceOrder.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: items.map((item) => this.toServiceOrderResponse(item)),
      hasNext: page < totalPages,
      meta: { page, pageSize, total, totalPages },
    };
  }

  async getServiceOrderById(
    context: MaintenanceActorContext,
    serviceOrderId: string,
  ): Promise<ServiceOrderWithRelations> {
    const order = await prisma.serviceOrder.findFirst({
      where: {
        id: serviceOrderId,
        tenantId: context.tenantId,
      },
      include: serviceOrderInclude,
    });

    if (!order) {
      throw new NotFoundError('Ordem de serviço não encontrada');
    }

    return this.toServiceOrderResponse(order);
  }

  async createServiceOrder(
    context: MaintenanceActorContext,
    input: ServiceOrderCreateInput,
  ): Promise<ServiceOrderWithRelations> {
    const { tenantId, userId, ipAddress, userAgent } = context;

    await ensureVehicleBelongsToTenant(tenantId, input.vehicleId);
    await ensureDriverBelongsToTenant(tenantId, input.driverId ?? null);
    await ensurePlanBelongsToTenant(tenantId, input.planId ?? null, input.vehicleId, input.type);

    const { normalizedItems, laborCost, partsCost, totalCost } = resolveOrderCosts(input);

    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.serviceOrder.create({
        data: {
          tenantId,
          vehicleId: input.vehicleId,
          driverId: input.driverId ?? null,
          planId: input.planId ?? null,
          type: toDatabaseMaintenanceType(input.type),
          status: toDatabaseServiceOrderStatus(ServiceOrderStatus.OPEN),
          description: input.description.trim(),
          workshop: normalizeOptionalString(input.workshop),
          startDate: null,
          endDate: null,
          totalCost,
          laborCost,
          partsCost,
          notes: normalizeOptionalString(input.notes),
          photos: normalizePhotos(input.photos),
          invoiceUrl: normalizeFileUrl(input.invoiceUrl),
          approvedByUserId: null,
          createdByUserId: userId,
          ...(normalizedItems.length > 0
            ? {
                items: {
                  create: normalizedItems,
                },
              }
            : {}),
        },
        include: serviceOrderInclude,
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'SERVICE_ORDER_CREATED',
          entity: SERVICE_ORDER_ENTITY,
          entityId: order.id,
          changes: toAuditChanges({
            vehicleId: input.vehicleId,
            driverId: input.driverId ?? null,
            planId: input.planId ?? null,
            type: input.type,
            status: ServiceOrderStatus.OPEN,
            totalCost,
            itemCount: normalizedItems.length,
          }),
          ipAddress,
          userAgent,
        },
      });

      return order;
    });

    return this.toServiceOrderResponse(created);
  }

  async replaceServiceOrder(
    context: MaintenanceActorContext,
    serviceOrderId: string,
    input: ServiceOrderReplaceInput,
  ): Promise<ServiceOrderWithRelations> {
    const { tenantId, userId, ipAddress, userAgent } = context;

    const current = await prisma.serviceOrder.findFirst({
      where: {
        id: serviceOrderId,
        tenantId,
      },
      include: serviceOrderInclude,
    });

    if (!current) {
      throw new NotFoundError('Ordem de serviço não encontrada');
    }

    const vehicle = await ensureVehicleBelongsToTenant(tenantId, input.vehicleId);
    const plan = await ensurePlanBelongsToTenant(
      tenantId,
      input.planId ?? null,
      input.vehicleId,
      input.type,
    );
    await ensureDriverBelongsToTenant(tenantId, input.driverId ?? null);

    const currentStatus = current.status as unknown as ServiceOrderStatus;
    const nextStatus = input.status;

    assertValidTransition(currentStatus, nextStatus);

    const { normalizedItems, laborCost, partsCost, totalCost } = resolveOrderCosts(input);
    const { startDate, endDate } = resolveOrderDates({
      currentStatus,
      nextStatus,
      currentStartDate: current.startDate,
      currentEndDate: current.endDate,
      inputStartDate: input.startDate,
      inputEndDate: input.endDate,
    });

    validateOrderDates(nextStatus, startDate, endDate);

    const approvedByUserId =
      nextStatus === ServiceOrderStatus.APPROVED
        ? userId
        : nextStatus === ServiceOrderStatus.IN_PROGRESS ||
            nextStatus === ServiceOrderStatus.COMPLETED
          ? (current.approvedByUserId ?? userId)
          : null;

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.serviceOrder.update({
        where: {
          id: serviceOrderId,
        },
        data: {
          vehicleId: input.vehicleId,
          driverId: input.driverId ?? null,
          planId: input.planId ?? null,
          type: toDatabaseMaintenanceType(input.type),
          status: toDatabaseServiceOrderStatus(nextStatus),
          description: input.description.trim(),
          workshop: normalizeOptionalString(input.workshop),
          startDate,
          endDate,
          totalCost,
          laborCost,
          partsCost,
          notes: normalizeOptionalString(input.notes),
          photos: normalizePhotos(input.photos),
          invoiceUrl: normalizeFileUrl(input.invoiceUrl),
          approvedByUserId,
          items: {
            deleteMany: {},
            ...(normalizedItems.length > 0
              ? {
                  create: normalizedItems,
                }
              : {}),
          },
        },
        include: serviceOrderInclude,
      });

      if (
        currentStatus !== ServiceOrderStatus.COMPLETED &&
        nextStatus === ServiceOrderStatus.COMPLETED &&
        plan &&
        endDate
      ) {
        await tx.maintenancePlan.update({
          where: {
            id: plan.id,
          },
          data: {
            lastExecutedAt: endDate,
            lastExecutedMileage: vehicle.currentMileage,
            nextDueAt: plan.intervalDays ? addDays(endDate, plan.intervalDays) : null,
            nextDueMileage: plan.intervalKm ? vehicle.currentMileage + plan.intervalKm : null,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'SERVICE_ORDER_UPDATED',
          entity: SERVICE_ORDER_ENTITY,
          entityId: serviceOrderId,
          changes: toAuditChanges({
            before: {
              status: current.status,
              vehicleId: current.vehicleId,
              driverId: current.driverId,
              planId: current.planId,
              totalCost: current.totalCost,
            },
            after: {
              status: nextStatus,
              vehicleId: input.vehicleId,
              driverId: input.driverId ?? null,
              planId: input.planId ?? null,
              totalCost,
            },
          }),
          ipAddress,
          userAgent,
        },
      });

      return order;
    });

    return this.toServiceOrderResponse(updated);
  }

  async deleteServiceOrder(
    context: MaintenanceActorContext,
    serviceOrderId: string,
  ): Promise<ServiceOrderDeletionResult> {
    const { tenantId, userId, ipAddress, userAgent } = context;

    const order = await prisma.serviceOrder.findFirst({
      where: {
        id: serviceOrderId,
        tenantId,
      },
      include: serviceOrderInclude,
    });

    if (!order) {
      throw new NotFoundError('Ordem de serviço não encontrada');
    }

    const currentStatus = order.status as unknown as ServiceOrderStatus;
    const auditCount = await prisma.auditLog.count({
      where: {
        tenantId,
        entity: SERVICE_ORDER_ENTITY,
        entityId: serviceOrderId,
      },
    });

    const shouldHardDelete = auditCount <= 1 && currentStatus === ServiceOrderStatus.OPEN;

    if (shouldHardDelete) {
      return prisma.$transaction(async (tx) => {
        await tx.auditLog.deleteMany({
          where: {
            tenantId,
            entity: SERVICE_ORDER_ENTITY,
            entityId: serviceOrderId,
          },
        });

        await tx.serviceOrder.delete({
          where: {
            id: serviceOrderId,
          },
        });

        return {
          deleted: true,
          mode: 'hard',
          serviceOrderId,
        };
      });
    }

    if (
      currentStatus !== ServiceOrderStatus.OPEN &&
      currentStatus !== ServiceOrderStatus.CANCELLED
    ) {
      throw new ValidationError('Apenas ordens em aberto podem ser excluídas');
    }

    if (currentStatus === ServiceOrderStatus.OPEN) {
      await prisma.$transaction(async (tx) => {
        await tx.serviceOrder.update({
          where: {
            id: serviceOrderId,
          },
          data: {
            status: toDatabaseServiceOrderStatus(ServiceOrderStatus.CANCELLED),
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId,
            userId,
            action: 'SERVICE_ORDER_DELETED',
            entity: SERVICE_ORDER_ENTITY,
            entityId: serviceOrderId,
            changes: toAuditChanges({
              before: { status: currentStatus },
              after: { status: ServiceOrderStatus.CANCELLED },
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
      serviceOrderId,
    };
  }

  private toServiceOrderResponse(record: ServiceOrderRecord): ServiceOrderWithRelations {
    return {
      id: record.id,
      tenantId: record.tenantId,
      vehicleId: record.vehicleId,
      driverId: record.driverId,
      planId: record.planId,
      type: record.type,
      status: record.status,
      description: record.description,
      workshop: record.workshop,
      startDate: record.startDate,
      endDate: record.endDate,
      totalCost: record.totalCost,
      laborCost: record.laborCost,
      partsCost: record.partsCost,
      notes: record.notes,
      photos: Array.isArray(record.photos) ? (record.photos as string[]) : [],
      invoiceUrl: record.invoiceUrl,
      approvedByUserId: record.approvedByUserId,
      createdByUserId: record.createdByUserId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      vehicle: record.vehicle,
      driver: record.driver,
      plan: record.plan
        ? {
            id: record.plan.id,
            name: record.plan.name,
            type: record.plan.type,
          }
        : null,
      approvedByUser: record.approvedByUser,
      createdByUser: record.createdByUser,
      items: record.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalCost: item.totalCost,
        partNumber: item.partNumber,
      })),
    };
  }
}

export const serviceOrdersService = new ServiceOrdersService();
