import { Prisma } from '@frota-leve/database';
import type { TireStatus as DatabaseTireStatus } from '@frota-leve/database';
import { TireStatus } from '@frota-leve/shared';
import { prisma } from '../../config/database';
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../shared/errors';
import type {
  TireActorContext,
  TireBrandComparisonItem,
  TireCostStatsItem,
  TireDeletionResult,
  TireInspectionResponse,
  TireListResponse,
  TireReplacementAlertItem,
  TireReplacementAlertsResponse,
  TireStatsResponse,
  TireWithRelations,
} from './tires.types';
import type {
  CreateTireInput,
  CreateTireInspectionInput,
  ListTiresQueryInput,
  MoveTireInput,
  ReplaceTireInput,
  TireAlertsQueryInput,
  TireStatsQueryInput,
} from './tires.validators';
import {
  buildTireReplacementAlertWhere,
  calculateMmBelowThreshold,
  calculateRemainingUsefulLifePercentage,
  compareReplacementAlertUrgency,
  roundToTwoDecimals,
  TIRE_ENTITY,
} from './tires.alerts';

const TIRE_INSPECTION_ENTITY = 'TireInspection';
const MAX_GROOVE_DEPTH_INCREASE_TOLERANCE = 0.5;

const tireInclude = {
  currentVehicle: {
    select: {
      id: true,
      plate: true,
      brand: true,
      model: true,
      year: true,
    },
  },
} satisfies Prisma.TireInclude;

type TireRecord = Prisma.TireGetPayload<{ include: typeof tireInclude }>;
type TransactionClient = Prisma.TransactionClient;

const tireInspectionInclude = {
  vehicle: {
    select: {
      id: true,
      plate: true,
      brand: true,
      model: true,
      year: true,
    },
  },
  inspectedByUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.TireInspectionInclude;

type TireInspectionRecordWithRelations = Prisma.TireInspectionGetPayload<{
  include: typeof tireInspectionInclude;
}>;

const ALLOWED_TRANSITIONS: Record<TireStatus, TireStatus[]> = {
  [TireStatus.NEW]: [TireStatus.IN_USE, TireStatus.DISCARDED],
  [TireStatus.IN_USE]: [TireStatus.RETREADED, TireStatus.DISCARDED],
  [TireStatus.RETREADED]: [TireStatus.IN_USE, TireStatus.DISCARDED],
  [TireStatus.DISCARDED]: [],
};

function toDatabaseTireStatus(value: TireStatus): DatabaseTireStatus {
  return value as unknown as DatabaseTireStatus;
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeUppercase(value: string): string {
  return value.trim().toUpperCase();
}

function normalizePhotos(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function toAuditChanges(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value == null) {
    return Prisma.JsonNull;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildTireWhere(tenantId: string, query: ListTiresQueryInput): Prisma.TireWhereInput {
  const where: Prisma.TireWhereInput = {
    tenantId,
    ...(query.status ? { status: toDatabaseTireStatus(query.status) } : {}),
    ...(query.currentVehicleId ? { currentVehicleId: query.currentVehicleId } : {}),
  };

  if (query.search) {
    const search = query.search.trim();

    where.OR = [
      { brand: { contains: search, mode: 'insensitive' } },
      { model: { contains: search, mode: 'insensitive' } },
      { size: { contains: search, mode: 'insensitive' } },
      { serialNumber: { contains: search, mode: 'insensitive' } },
      { dot: { contains: search, mode: 'insensitive' } },
      { position: { contains: search, mode: 'insensitive' } },
      {
        currentVehicle: {
          is: {
            plate: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      },
      {
        currentVehicle: {
          is: {
            model: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      },
    ];
  }

  return where;
}

function buildTireStatsWhere(tenantId: string, query: TireStatsQueryInput): Prisma.TireWhereInput {
  return {
    tenantId,
    ...(query.vehicleId ? { currentVehicleId: query.vehicleId } : {}),
    ...(query.status ? { status: toDatabaseTireStatus(query.status) } : {}),
    ...(query.brand
      ? {
          brand: {
            contains: query.brand,
            mode: 'insensitive',
          },
        }
      : {}),
    ...(query.model
      ? {
          model: {
            contains: query.model,
            mode: 'insensitive',
          },
        }
      : {}),
  };
}

function buildTirePayload(input: CreateTireInput | ReplaceTireInput) {
  return {
    brand: input.brand.trim(),
    model: input.model.trim(),
    size: normalizeUppercase(input.size),
    serialNumber: normalizeUppercase(input.serialNumber),
    dot: normalizeUppercase(input.dot),
    status: toDatabaseTireStatus(input.status),
    currentVehicleId: input.currentVehicleId ?? null,
    position: normalizeOptionalString(input.position),
    currentGrooveDepth: input.currentGrooveDepth,
    originalGrooveDepth: input.originalGrooveDepth,
    retreatCount: input.retreatCount,
    costNew: input.costNew,
    costRetreat: input.costRetreat,
    totalKm: input.totalKm,
  };
}

function assertValidTransition(current: TireStatus, next: TireStatus): void {
  if (current === next) {
    return;
  }

  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    throw new ValidationError(`Transição de ciclo de vida inválida: ${current} → ${next}`);
  }
}

function assertLifecycleBusinessRules(
  input: CreateTireInput | ReplaceTireInput,
  current?: {
    status: TireStatus;
    retreatCount: number;
  },
): void {
  if (input.status === TireStatus.NEW && input.totalKm > 0) {
    throw new ValidationError('Pneu novo não pode ter quilometragem acumulada');
  }

  if (!current) {
    return;
  }

  if (input.retreatCount < current.retreatCount) {
    throw new ValidationError('Quantidade de recapagens não pode diminuir');
  }

  if (
    current.status === TireStatus.IN_USE &&
    input.status === TireStatus.RETREADED &&
    input.retreatCount <= current.retreatCount
  ) {
    throw new ValidationError('Ao recapear o pneu, incremente a quantidade de recapagens');
  }
}

async function createAuditLog(
  tx: TransactionClient,
  context: TireActorContext,
  params: {
    action: string;
    entityId: string;
    changes: unknown;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId: context.tenantId,
      userId: context.userId,
      action: params.action,
      entity: TIRE_ENTITY,
      entityId: params.entityId,
      changes: toAuditChanges(params.changes),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });
}

async function ensureVehicleExists(
  tenantId: string,
  vehicleId: string | null | undefined,
): Promise<void> {
  if (!vehicleId) {
    return;
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenantId },
    select: { id: true },
  });

  if (!vehicle) {
    throw new NotFoundError('Veículo não encontrado');
  }
}

async function ensureUniqueSerialNumber(
  tenantId: string,
  serialNumber: string,
  excludeTireId?: string,
): Promise<void> {
  const existing = await prisma.tire.findFirst({
    where: {
      tenantId,
      serialNumber: normalizeUppercase(serialNumber),
      ...(excludeTireId
        ? {
            id: {
              not: excludeTireId,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    throw new ConflictError('Número de série já cadastrado neste tenant');
  }
}

async function ensureVehiclePositionAvailable(
  tenantId: string,
  currentVehicleId: string | null | undefined,
  position: string | null | undefined,
  excludeTireId?: string,
): Promise<void> {
  const normalizedPosition = normalizeOptionalString(position);

  if (!currentVehicleId || !normalizedPosition) {
    return;
  }

  const existing = await prisma.tire.findFirst({
    where: {
      tenantId,
      currentVehicleId,
      status: toDatabaseTireStatus(TireStatus.IN_USE),
      position: {
        equals: normalizedPosition,
        mode: 'insensitive',
      },
      ...(excludeTireId
        ? {
            id: {
              not: excludeTireId,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    throw new ConflictError('Já existe um pneu em uso nesta posição do veículo');
  }
}

function buildInspectionWearMetrics(
  previousGrooveDepth: number,
  currentGrooveDepth: number,
  originalGrooveDepth: number,
) {
  const lossSinceLastInspection = roundToTwoDecimals(
    Math.max(previousGrooveDepth - currentGrooveDepth, 0),
  );
  const totalLoss = roundToTwoDecimals(Math.max(originalGrooveDepth - currentGrooveDepth, 0));
  const wearPercentage =
    originalGrooveDepth === 0 ? 0 : roundToTwoDecimals((totalLoss / originalGrooveDepth) * 100);
  const remainingUsefulLifePercentage =
    originalGrooveDepth === 0
      ? 0
      : roundToTwoDecimals((currentGrooveDepth / originalGrooveDepth) * 100);

  return {
    previousGrooveDepth: roundToTwoDecimals(previousGrooveDepth),
    currentGrooveDepth: roundToTwoDecimals(currentGrooveDepth),
    lossSinceLastInspection,
    totalLoss,
    wearPercentage,
    remainingUsefulLifePercentage,
  };
}

function calculateTireTotalCost(
  tire: Pick<TireWithRelations, 'costNew' | 'costRetreat' | 'retreatCount'>,
): number {
  return roundToTwoDecimals(tire.costNew + tire.costRetreat * tire.retreatCount);
}

function calculateCostPerKm(totalCost: number, totalKm: number): number | null {
  if (totalKm <= 0) {
    return null;
  }

  return roundToTwoDecimals(totalCost / totalKm);
}

function calculateCostPerThousandKm(totalCost: number, totalKm: number): number | null {
  if (totalKm <= 0) {
    return null;
  }

  return roundToTwoDecimals((totalCost / totalKm) * 1000);
}

function compareTireCostStats(a: TireCostStatsItem, b: TireCostStatsItem): number {
  const costA = a.costPerKm ?? Number.POSITIVE_INFINITY;
  const costB = b.costPerKm ?? Number.POSITIVE_INFINITY;

  if (costA !== costB) {
    return costA - costB;
  }

  if (a.totalKm !== b.totalKm) {
    return b.totalKm - a.totalKm;
  }

  return a.serialNumber.localeCompare(b.serialNumber);
}

type TireBrandAccumulator = {
  brand: string;
  tireCount: number;
  tiresWithKm: number;
  totalKm: number;
  totalCost: number;
  drivenKm: number;
  drivenCost: number;
  retreatCountTotal: number;
};

export class TiresService {
  async getStats(
    context: TireActorContext,
    query: TireStatsQueryInput,
  ): Promise<TireStatsResponse> {
    const tires = await prisma.tire.findMany({
      where: buildTireStatsWhere(context.tenantId, query),
      include: tireInclude,
    });

    const byTire = tires
      .map((tire): TireCostStatsItem => {
        const response = this.toTireResponse(tire);
        const retreatInvestment = roundToTwoDecimals(tire.costRetreat * tire.retreatCount);
        const totalCost = calculateTireTotalCost(response);
        const costPerKm = calculateCostPerKm(totalCost, tire.totalKm);

        return {
          ...response,
          totalCost,
          retreatInvestment,
          costPerKm,
          costPerThousandKm: calculateCostPerThousandKm(totalCost, tire.totalKm),
        };
      })
      .sort(compareTireCostStats);

    const limitedByTire = byTire.slice(0, query.limit);

    const brandComparisons = Array.from(
      byTire
        .reduce<Map<string, TireBrandAccumulator>>((acc, tire) => {
          const key = tire.brand.trim().toUpperCase();
          const current = acc.get(key);

          if (!current) {
            acc.set(key, {
              brand: tire.brand,
              tireCount: 1,
              tiresWithKm: tire.totalKm > 0 ? 1 : 0,
              totalKm: tire.totalKm,
              totalCost: tire.totalCost,
              drivenKm: tire.totalKm > 0 ? tire.totalKm : 0,
              drivenCost: tire.totalKm > 0 ? tire.totalCost : 0,
              retreatCountTotal: tire.retreatCount,
            });
            return acc;
          }

          current.tireCount += 1;
          current.tiresWithKm += tire.totalKm > 0 ? 1 : 0;
          current.totalKm = roundToTwoDecimals(current.totalKm + tire.totalKm);
          current.totalCost = roundToTwoDecimals(current.totalCost + tire.totalCost);
          current.drivenKm = roundToTwoDecimals(
            current.drivenKm + (tire.totalKm > 0 ? tire.totalKm : 0),
          );
          current.drivenCost = roundToTwoDecimals(
            current.drivenCost + (tire.totalKm > 0 ? tire.totalCost : 0),
          );
          current.retreatCountTotal += tire.retreatCount;

          return acc;
        }, new Map())
        .values(),
    ).map((item): TireBrandComparisonItem => {
      const averageCostPerKm = calculateCostPerKm(item.drivenCost, item.drivenKm);

      return {
        brand: item.brand,
        tireCount: item.tireCount,
        tiresWithKm: item.tiresWithKm,
        totalKm: item.totalKm,
        totalCost: item.totalCost,
        averageCostPerKm,
        averageCostPerThousandKm: calculateCostPerThousandKm(item.drivenCost, item.drivenKm),
        averageKmPerTire:
          item.tireCount > 0 ? roundToTwoDecimals(item.totalKm / item.tireCount) : null,
        averageRetreatCount: roundToTwoDecimals(item.retreatCountTotal / item.tireCount),
      };
    });

    const byBrand = brandComparisons
      .sort((a, b) => {
        const costA = a.averageCostPerKm ?? Number.POSITIVE_INFINITY;
        const costB = b.averageCostPerKm ?? Number.POSITIVE_INFINITY;

        if (costA !== costB) {
          return costA - costB;
        }

        if (a.totalKm !== b.totalKm) {
          return b.totalKm - a.totalKm;
        }

        return a.brand.localeCompare(b.brand);
      })
      .slice(0, query.brandLimit);

    const totalTires = byTire.length;
    const tiresWithKm = byTire.filter((tire) => tire.totalKm > 0).length;
    const totalKm = roundToTwoDecimals(byTire.reduce((sum, tire) => sum + tire.totalKm, 0));
    const totalCost = roundToTwoDecimals(byTire.reduce((sum, tire) => sum + tire.totalCost, 0));
    const drivenTotals = byTire.reduce(
      (acc, tire) => {
        if (tire.totalKm <= 0) {
          return acc;
        }

        return {
          totalKm: roundToTwoDecimals(acc.totalKm + tire.totalKm),
          totalCost: roundToTwoDecimals(acc.totalCost + tire.totalCost),
        };
      },
      { totalKm: 0, totalCost: 0 },
    );
    const averageCostPerKm = calculateCostPerKm(drivenTotals.totalCost, drivenTotals.totalKm);

    return {
      summary: {
        totalTires,
        tiresWithKm,
        tiresWithoutKm: totalTires - tiresWithKm,
        totalKm,
        totalCost,
        averageCostPerKm,
        averageCostPerThousandKm: calculateCostPerThousandKm(
          drivenTotals.totalCost,
          drivenTotals.totalKm,
        ),
        bestBrand: byBrand[0]?.brand ?? null,
        worstBrand: byBrand.length > 0 ? (byBrand[byBrand.length - 1]?.brand ?? null) : null,
      },
      byTire: limitedByTire,
      byBrand,
    };
  }

  async getReplacementAlerts(
    context: TireActorContext,
    query: TireAlertsQueryInput,
  ): Promise<TireReplacementAlertsResponse> {
    const tires = await prisma.tire.findMany({
      where: buildTireReplacementAlertWhere(context.tenantId, query.threshold, query.vehicleId),
      include: tireInclude,
    });

    const alerts = tires
      .map((tire): TireReplacementAlertItem => {
        const response = this.toTireResponse(tire);

        return {
          ...response,
          threshold: query.threshold,
          mmBelowThreshold: calculateMmBelowThreshold(tire.currentGrooveDepth, query.threshold),
          remainingUsefulLifePercentage: calculateRemainingUsefulLifePercentage(
            tire.currentGrooveDepth,
            tire.originalGrooveDepth,
          ),
        };
      })
      .sort(compareReplacementAlertUrgency);

    const items = alerts.slice(0, query.limit);

    const averageGrooveDepth =
      alerts.length > 0
        ? roundToTwoDecimals(
            alerts.reduce((sum, item) => sum + item.currentGrooveDepth, 0) / alerts.length,
          )
        : null;

    return {
      items,
      summary: {
        total: alerts.length,
        threshold: query.threshold,
        averageGrooveDepth,
        lowestGrooveDepth: alerts[0]?.currentGrooveDepth ?? null,
      },
    };
  }

  async listTires(
    context: TireActorContext,
    query: ListTiresQueryInput,
  ): Promise<TireListResponse<TireWithRelations>> {
    const where = buildTireWhere(context.tenantId, query);

    const [items, total] = await Promise.all([
      prisma.tire.findMany({
        where,
        include: tireInclude,
        orderBy: {
          [query.sortBy]: query.sortOrder,
        } as Prisma.TireOrderByWithRelationInput,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.tire.count({ where }),
    ]);

    const totalPages = Math.max(Math.ceil(total / query.pageSize), 1);

    return {
      items: items.map((item) => this.toTireResponse(item)),
      hasNext: query.page < totalPages,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages,
      },
    };
  }

  async getTireById(context: TireActorContext, tireId: string): Promise<TireWithRelations> {
    const tire = await prisma.tire.findFirst({
      where: {
        id: tireId,
        tenantId: context.tenantId,
      },
      include: tireInclude,
    });

    if (!tire) {
      throw new NotFoundError('Pneu não encontrado');
    }

    return this.toTireResponse(tire);
  }

  async createTire(context: TireActorContext, input: CreateTireInput): Promise<TireWithRelations> {
    await ensureVehicleExists(context.tenantId, input.currentVehicleId ?? null);
    await ensureUniqueSerialNumber(context.tenantId, input.serialNumber);
    await ensureVehiclePositionAvailable(
      context.tenantId,
      input.currentVehicleId ?? null,
      input.position ?? null,
    );
    assertLifecycleBusinessRules(input);

    const created = await prisma.$transaction(async (tx) => {
      const tire = await tx.tire.create({
        data: {
          tenantId: context.tenantId,
          ...buildTirePayload(input),
        },
        include: tireInclude,
      });

      await createAuditLog(tx, context, {
        action: 'TIRE_CREATED',
        entityId: tire.id,
        changes: {
          serialNumber: tire.serialNumber,
          status: tire.status,
          currentVehicleId: tire.currentVehicleId,
          position: tire.position,
          retreatCount: tire.retreatCount,
          totalKm: tire.totalKm,
        },
      });

      return tire;
    });

    return this.toTireResponse(created);
  }

  async replaceTire(
    context: TireActorContext,
    tireId: string,
    input: ReplaceTireInput,
  ): Promise<TireWithRelations> {
    const current = await prisma.tire.findFirst({
      where: {
        id: tireId,
        tenantId: context.tenantId,
      },
      include: tireInclude,
    });

    if (!current) {
      throw new NotFoundError('Pneu não encontrado');
    }

    const currentStatus = current.status as unknown as TireStatus;

    assertValidTransition(currentStatus, input.status);
    assertLifecycleBusinessRules(input, {
      status: currentStatus,
      retreatCount: current.retreatCount,
    });

    await ensureVehicleExists(context.tenantId, input.currentVehicleId ?? null);
    await ensureUniqueSerialNumber(context.tenantId, input.serialNumber, tireId);
    await ensureVehiclePositionAvailable(
      context.tenantId,
      input.currentVehicleId ?? null,
      input.position ?? null,
      tireId,
    );

    const updated = await prisma.$transaction(async (tx) => {
      const tire = await tx.tire.update({
        where: { id: tireId },
        data: buildTirePayload(input),
        include: tireInclude,
      });

      await createAuditLog(tx, context, {
        action: 'TIRE_UPDATED',
        entityId: tireId,
        changes: {
          before: {
            status: current.status,
            currentVehicleId: current.currentVehicleId,
            position: current.position,
            retreatCount: current.retreatCount,
            totalKm: current.totalKm,
          },
          after: {
            status: tire.status,
            currentVehicleId: tire.currentVehicleId,
            position: tire.position,
            retreatCount: tire.retreatCount,
            totalKm: tire.totalKm,
          },
        },
      });

      return tire;
    });

    return this.toTireResponse(updated);
  }

  async moveTire(
    context: TireActorContext,
    tireId: string,
    input: MoveTireInput,
  ): Promise<TireWithRelations> {
    const tire = await prisma.tire.findFirst({
      where: {
        id: tireId,
        tenantId: context.tenantId,
      },
      include: tireInclude,
    });

    if (!tire) {
      throw new NotFoundError('Pneu não encontrado');
    }

    const currentStatus = tire.status as unknown as TireStatus;

    if (currentStatus === TireStatus.DISCARDED) {
      throw new ValidationError('Pneu descartado não pode ser movimentado');
    }

    await ensureVehicleExists(context.tenantId, input.vehicleId);
    await ensureVehiclePositionAvailable(context.tenantId, input.vehicleId, input.position, tireId);

    const normalizedPosition = input.position.trim();
    const isSameVehicle = tire.currentVehicleId === input.vehicleId;
    const isSamePosition =
      normalizeOptionalString(tire.position)?.toLowerCase() === normalizedPosition.toLowerCase();

    if (isSameVehicle && isSamePosition) {
      throw new ValidationError('O pneu já está na posição informada');
    }

    assertValidTransition(currentStatus, TireStatus.IN_USE);

    const updated = await prisma.$transaction(async (tx) => {
      const movedTire = await tx.tire.update({
        where: {
          id: tireId,
        },
        data: {
          status: toDatabaseTireStatus(TireStatus.IN_USE),
          currentVehicleId: input.vehicleId,
          position: normalizedPosition,
        },
        include: tireInclude,
      });

      await createAuditLog(tx, context, {
        action: 'TIRE_MOVED',
        entityId: tireId,
        changes: {
          from: {
            status: tire.status,
            vehicleId: tire.currentVehicleId,
            position: tire.position,
          },
          to: {
            status: TireStatus.IN_USE,
            vehicleId: input.vehicleId,
            position: normalizedPosition,
          },
        },
      });

      return movedTire;
    });

    return this.toTireResponse(updated);
  }

  async deleteTire(context: TireActorContext, tireId: string): Promise<TireDeletionResult> {
    const tire = await prisma.tire.findFirst({
      where: {
        id: tireId,
        tenantId: context.tenantId,
      },
      include: tireInclude,
    });

    if (!tire) {
      throw new NotFoundError('Pneu não encontrado');
    }

    if ((tire.status as unknown as TireStatus) === TireStatus.IN_USE) {
      throw new ValidationError('Pneu em uso não pode ser excluído');
    }

    const inspectionCount = await prisma.tireInspection.count({
      where: {
        tenantId: context.tenantId,
        tireId,
      },
    });

    if (inspectionCount > 0) {
      throw new ValidationError('Pneu com inspeções registradas não pode ser excluído');
    }

    await prisma.$transaction(async (tx) => {
      await createAuditLog(tx, context, {
        action: 'TIRE_DELETED',
        entityId: tireId,
        changes: {
          serialNumber: tire.serialNumber,
          status: tire.status,
        },
      });

      await tx.tire.delete({
        where: { id: tireId },
      });
    });

    return {
      deleted: true,
      tireId,
    };
  }

  async listInspections(
    context: TireActorContext,
    tireId: string,
    query: { page: number; pageSize: number },
  ): Promise<TireListResponse<ReturnType<TiresService['toTireInspectionResponse']>>> {
    const { tenantId } = context;

    const tire = await prisma.tire.findFirst({
      where: { id: tireId, tenantId },
      select: { id: true },
    });

    if (!tire) throw new NotFoundError('Pneu não encontrado');

    const { page, pageSize } = query;

    const [items, total] = await Promise.all([
      prisma.tireInspection.findMany({
        where: { tireId, tenantId },
        include: tireInspectionInclude,
        orderBy: { date: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.tireInspection.count({ where: { tireId, tenantId } }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: items.map((i) => this.toTireInspectionResponse(i)),
      hasNext: page < totalPages,
      meta: { page, pageSize, total, totalPages },
    };
  }

  async registerInspection(
    context: TireActorContext,
    tireId: string,
    input: CreateTireInspectionInput,
  ): Promise<TireInspectionResponse> {
    const inspectedByUserId = context.userId;

    if (!inspectedByUserId) {
      throw new UnauthorizedError('Usuário não autenticado');
    }

    const tire = await prisma.tire.findFirst({
      where: {
        id: tireId,
        tenantId: context.tenantId,
      },
      include: tireInclude,
    });

    if (!tire) {
      throw new NotFoundError('Pneu não encontrado');
    }

    if ((tire.status as unknown as TireStatus) !== TireStatus.IN_USE) {
      throw new ValidationError('Somente pneus em uso podem receber inspeção de sulcagem');
    }

    if (!tire.currentVehicleId || !tire.position) {
      throw new ValidationError('Pneu em uso sem veículo ou posição vinculada');
    }

    if (input.vehicleId !== tire.currentVehicleId) {
      throw new ValidationError('A inspeção deve ser registrada para o veículo atual do pneu');
    }

    if (input.position.trim().toLowerCase() !== tire.position.trim().toLowerCase()) {
      throw new ValidationError('A posição informada deve corresponder à posição atual do pneu');
    }

    if (input.grooveDepth > tire.originalGrooveDepth) {
      throw new ValidationError('Sulco informado não pode ser maior que o sulco original');
    }

    if (input.grooveDepth > tire.currentGrooveDepth + MAX_GROOVE_DEPTH_INCREASE_TOLERANCE) {
      throw new ValidationError(
        'Sulco informado excede a medição atual do pneu; revise a leitura ou atualize o ciclo de vida primeiro',
      );
    }

    const latestInspection = await prisma.tireInspection.findFirst({
      where: {
        tenantId: context.tenantId,
        tireId,
      },
      orderBy: {
        date: 'desc',
      },
      select: {
        date: true,
      },
    });

    if (latestInspection && input.date < latestInspection.date) {
      throw new ValidationError(
        'A data da inspeção não pode ser anterior à última inspeção registrada para este pneu',
      );
    }

    const wear = buildInspectionWearMetrics(
      tire.currentGrooveDepth,
      input.grooveDepth,
      tire.originalGrooveDepth,
    );

    const created = await prisma.$transaction(
      async (
        tx,
      ): Promise<{
        inspection: TireInspectionRecordWithRelations;
        updatedTire: TireRecord;
      }> => {
        const inspection = await tx.tireInspection.create({
          data: {
            tenantId: context.tenantId,
            tireId,
            vehicleId: input.vehicleId,
            inspectedByUserId,
            date: input.date,
            grooveDepth: input.grooveDepth,
            position: input.position.trim(),
            ...(input.photos && input.photos.length > 0
              ? {
                  photos: input.photos as Prisma.InputJsonValue,
                }
              : {}),
            notes: normalizeOptionalString(input.notes),
          },
          include: tireInspectionInclude,
        });

        const updatedTire = await tx.tire.update({
          where: {
            id: tireId,
          },
          data: {
            currentGrooveDepth: input.grooveDepth,
          },
          include: tireInclude,
        });

        await createAuditLog(tx, context, {
          action: 'TIRE_INSPECTION_CREATED',
          entityId: tireId,
          changes: {
            inspectionId: inspection.id,
            previousGrooveDepth: tire.currentGrooveDepth,
            currentGrooveDepth: input.grooveDepth,
            wear,
            vehicleId: input.vehicleId,
            position: input.position.trim(),
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId: context.tenantId,
            userId: context.userId,
            action: 'TIRE_INSPECTION_RECORDED',
            entity: TIRE_INSPECTION_ENTITY,
            entityId: inspection.id,
            changes: toAuditChanges({
              tireId,
              previousGrooveDepth: tire.currentGrooveDepth,
              currentGrooveDepth: input.grooveDepth,
              wear,
            }),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });

        return {
          inspection,
          updatedTire,
        };
      },
    );

    return {
      inspection: this.toTireInspectionResponse(created.inspection),
      wear,
      tire: this.toTireResponse(created.updatedTire),
    };
  }

  private toTireResponse(record: TireRecord): TireWithRelations {
    return {
      id: record.id,
      tenantId: record.tenantId,
      brand: record.brand,
      model: record.model,
      size: record.size,
      serialNumber: record.serialNumber,
      dot: record.dot,
      status: record.status,
      currentVehicleId: record.currentVehicleId,
      position: record.position,
      currentGrooveDepth: record.currentGrooveDepth,
      originalGrooveDepth: record.originalGrooveDepth,
      retreatCount: record.retreatCount,
      costNew: record.costNew,
      costRetreat: record.costRetreat,
      totalKm: record.totalKm,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      currentVehicle: record.currentVehicle,
    };
  }

  private toTireInspectionResponse(record: TireInspectionRecordWithRelations) {
    return {
      id: record.id,
      tenantId: record.tenantId,
      tireId: record.tireId,
      vehicleId: record.vehicleId,
      inspectedByUserId: record.inspectedByUserId,
      date: record.date,
      grooveDepth: record.grooveDepth,
      position: record.position,
      photos: normalizePhotos(record.photos),
      notes: record.notes,
      createdAt: record.createdAt,
      vehicle: record.vehicle,
      inspectedByUser: record.inspectedByUser,
    };
  }
}

export const tiresService = new TiresService();
