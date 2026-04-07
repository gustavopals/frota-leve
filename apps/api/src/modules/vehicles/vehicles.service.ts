import { FuelType, Prisma, UserRole, VehicleCategory, VehicleStatus } from '@frota-leve/database';
import type { PlanType as DatabasePlanType } from '@frota-leve/database';
import { PLAN_LIMITS, formatPlate } from '@frota-leve/shared';
import type { PlanType as SharedPlanType } from '@frota-leve/shared';
import { prisma } from '../../config/database';
import { ConflictError, NotFoundError, PlanLimitError, ValidationError } from '../../shared/errors';
import { parseVehicleImportFile } from './vehicles.import';
import type {
  VehicleActorContext,
  VehicleDeletionResult,
  VehicleImportError,
  VehicleImportResult,
  VehicleListResponse,
  VehicleStatsResponse,
  VehicleTimelineItem,
} from './vehicles.types';
import {
  createVehicleBodySchema,
  type VehicleCreateInput,
  type VehicleExportQueryInput,
  type VehicleListQueryInput,
  type VehicleMileageUpdateInput,
  type VehicleReplaceInput,
  type VehicleStatsQueryInput,
  type VehicleStatusUpdateInput,
} from './vehicles.validators';

const VEHICLE_ENTITY = 'Vehicle';
const DEFAULT_EXPORT_FILE_PREFIX = 'vehicles';

const vehicleInclude = {
  currentDriver: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.VehicleInclude;

type VehicleRecord = Prisma.VehicleGetPayload<{
  include: typeof vehicleInclude;
}>;

type VehicleFilterQuery = VehicleListQueryInput | VehicleExportQueryInput | VehicleStatsQueryInput;

type TransactionClient = Prisma.TransactionClient;

type ImportPreparedRow = {
  row: number;
  input: VehicleCreateInput;
  normalizedPlate: string;
  consumesPlanSlot: boolean;
};

function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/[\s-]/g, '');
}

function normalizeOptionalString(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeOptionalJsonArray(
  value: string[] | undefined,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!value || value.length === 0) {
    return Prisma.DbNull;
  }

  return value as Prisma.InputJsonValue;
}

function toAuditChanges(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value == null) {
    return Prisma.JsonNull;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function getPlanVehicleLimit(plan: DatabasePlanType): number {
  return PLAN_LIMITS[plan as unknown as SharedPlanType].maxVehicles;
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function getEnumCounter<TEnum extends string>(values: TEnum[]): Record<TEnum, number> {
  return values.reduce(
    (accumulator, value) => {
      accumulator[value] = 0;
      return accumulator;
    },
    {} as Record<TEnum, number>,
  );
}

function flattenValidationIssues(error: {
  issues: Array<{ path: Array<string | number>; message: string }>;
}): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  });
}

function escapeCsvValue(value: unknown): string {
  if (value == null) {
    return '';
  }

  const stringValue = String(value);

  if (/[",\n;]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function buildVehicleWhere(
  tenantId: string,
  filters: VehicleFilterQuery,
): Prisma.VehicleWhereInput {
  const where: Prisma.VehicleWhereInput = {
    tenantId,
  };

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.category) {
    where.category = filters.category;
  }

  if (filters.fuelType) {
    where.fuelType = filters.fuelType;
  }

  if (filters.search) {
    const normalizedSearch = filters.search.trim();
    const normalizedPlateSearch = normalizePlate(normalizedSearch);

    where.OR = [
      {
        plate: {
          contains: normalizedPlateSearch,
        },
      },
      {
        model: {
          contains: normalizedSearch,
          mode: 'insensitive',
        },
      },
    ];
  }

  return where;
}

function buildVehicleOrderBy(
  sortBy: VehicleListQueryInput['sortBy'] | VehicleExportQueryInput['sortBy'],
  sortOrder: VehicleListQueryInput['sortOrder'] | VehicleExportQueryInput['sortOrder'],
): Prisma.VehicleOrderByWithRelationInput {
  return {
    [sortBy]: sortOrder,
  } as Prisma.VehicleOrderByWithRelationInput;
}

function validateStatusTransition(currentStatus: VehicleStatus, nextStatus: VehicleStatus): void {
  if (currentStatus === nextStatus) {
    return;
  }

  if (currentStatus === VehicleStatus.DECOMMISSIONED) {
    throw new ValidationError('Veículo baixado não pode mudar para outro status');
  }
}

function createVehicleCounters() {
  return {
    byStatus: getEnumCounter(Object.values(VehicleStatus) as VehicleStatus[]),
    byCategory: getEnumCounter(Object.values(VehicleCategory) as VehicleCategory[]),
    byFuelType: getEnumCounter(Object.values(FuelType) as FuelType[]),
  };
}

function buildVehicleCreateData(
  tenantId: string,
  input: VehicleCreateInput,
): Prisma.VehicleUncheckedCreateInput {
  return {
    tenantId,
    plate: normalizePlate(input.plate),
    renavam: normalizeOptionalString(input.renavam) ?? undefined,
    chassis: normalizeOptionalString(input.chassis) ?? undefined,
    brand: input.brand.trim(),
    model: input.model.trim(),
    year: input.year,
    yearModel: input.yearModel,
    color: normalizeOptionalString(input.color) ?? undefined,
    fuelType: input.fuelType,
    category: input.category,
    status: input.status,
    currentMileage: input.currentMileage,
    expectedConsumption: input.expectedConsumption,
    acquisitionDate: input.acquisitionDate,
    acquisitionValue: input.acquisitionValue,
    ...(input.photos && input.photos.length > 0
      ? {
          photos: input.photos as Prisma.InputJsonValue,
        }
      : {}),
    notes: normalizeOptionalString(input.notes) ?? undefined,
    currentDriverId: input.currentDriverId,
  };
}

async function createAuditLog(
  tx: TransactionClient,
  context: VehicleActorContext,
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
      entity: VEHICLE_ENTITY,
      entityId: params.entityId,
      changes: toAuditChanges(params.changes),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });
}

async function ensureDriverBelongsToTenant(
  tenantId: string,
  currentDriverId: string,
): Promise<void> {
  const driver = await prisma.user.findFirst({
    where: {
      id: currentDriverId,
      tenantId,
      role: UserRole.DRIVER,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!driver) {
    throw new ValidationError('Motorista atual inválido para este tenant');
  }
}

async function ensureVehiclePlanLimit(
  tenantId: string,
  tenantPlan: DatabasePlanType,
  additionalVehicles: number,
): Promise<void> {
  const maxVehicles = getPlanVehicleLimit(tenantPlan);

  if (!Number.isFinite(maxVehicles)) {
    return;
  }

  const currentCount = await prisma.vehicle.count({
    where: {
      tenantId,
      status: {
        not: VehicleStatus.DECOMMISSIONED,
      },
    },
  });

  if (currentCount + additionalVehicles > maxVehicles) {
    throw new PlanLimitError('Limite de veículos do plano atingido', {
      currentCount,
      maxVehicles,
      requestedAdditionalVehicles: additionalVehicles,
    });
  }
}

async function ensureUniquePlate(
  tenantId: string,
  plate: string,
  excludeVehicleId?: string,
): Promise<void> {
  const existingVehicle = await prisma.vehicle.findFirst({
    where: {
      tenantId,
      plate,
      ...(excludeVehicleId
        ? {
            id: {
              not: excludeVehicleId,
            },
          }
        : {}),
    },
    select: {
      id: true,
    },
  });

  if (existingVehicle) {
    throw new ConflictError('Placa já cadastrada neste tenant');
  }
}

async function findVehicleOrThrow(tenantId: string, vehicleId: string): Promise<VehicleRecord> {
  const vehicle = await prisma.vehicle.findFirst({
    where: {
      id: vehicleId,
      tenantId,
    },
    include: vehicleInclude,
  });

  if (!vehicle) {
    throw new NotFoundError('Veículo não encontrado');
  }

  return vehicle;
}

function buildVehicleCsv(vehicles: VehicleRecord[]): string {
  const headers = [
    'plate',
    'brand',
    'model',
    'year',
    'yearModel',
    'status',
    'category',
    'fuelType',
    'currentMileage',
    'expectedConsumption',
    'acquisitionDate',
    'acquisitionValue',
    'currentDriverName',
    'currentDriverEmail',
    'notes',
  ];

  const rows = vehicles.map((vehicle) => [
    formatPlate(vehicle.plate),
    vehicle.brand,
    vehicle.model,
    vehicle.year,
    vehicle.yearModel,
    vehicle.status,
    vehicle.category,
    vehicle.fuelType,
    vehicle.currentMileage,
    vehicle.expectedConsumption ?? '',
    vehicle.acquisitionDate?.toISOString() ?? '',
    vehicle.acquisitionValue ?? '',
    vehicle.currentDriver?.name ?? '',
    vehicle.currentDriver?.email ?? '',
    vehicle.notes ?? '',
  ]);

  return `\uFEFF${[headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(','))
    .join('\n')}`;
}

export class VehiclesService {
  async listVehicles(
    context: VehicleActorContext,
    query: VehicleListQueryInput,
  ): Promise<VehicleListResponse<VehicleRecord>> {
    const where = buildVehicleWhere(context.tenantId, query);
    const orderBy = buildVehicleOrderBy(query.sortBy, query.sortOrder);
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await prisma.$transaction([
      prisma.vehicle.findMany({
        where,
        include: vehicleInclude,
        orderBy,
        skip,
        take: query.pageSize,
      }),
      prisma.vehicle.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / query.pageSize), 1),
      },
    };
  }

  async getVehicleById(
    context: VehicleActorContext,
    vehicleId: string,
  ): Promise<VehicleRecord & { timeline: VehicleTimelineItem[] }> {
    const [vehicle, timeline] = await Promise.all([
      findVehicleOrThrow(context.tenantId, vehicleId),
      prisma.auditLog.findMany({
        where: {
          tenantId: context.tenantId,
          entity: VEHICLE_ENTITY,
          entityId: vehicleId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    return {
      ...vehicle,
      timeline,
    };
  }

  async createVehicle(
    context: VehicleActorContext,
    input: VehicleCreateInput,
  ): Promise<VehicleRecord> {
    const normalizedPlate = normalizePlate(input.plate);

    if (input.currentDriverId) {
      await ensureDriverBelongsToTenant(context.tenantId, input.currentDriverId);
    }

    await ensureVehiclePlanLimit(
      context.tenantId,
      context.tenantPlan,
      input.status === VehicleStatus.DECOMMISSIONED ? 0 : 1,
    );
    await ensureUniquePlate(context.tenantId, normalizedPlate);

    return prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.create({
        data: buildVehicleCreateData(context.tenantId, input),
        include: vehicleInclude,
      });

      await createAuditLog(tx, context, {
        action: 'VEHICLE_CREATED',
        entityId: vehicle.id,
        changes: {
          after: vehicle,
        },
      });

      return vehicle;
    });
  }

  async replaceVehicle(
    context: VehicleActorContext,
    vehicleId: string,
    input: VehicleReplaceInput,
  ): Promise<VehicleRecord> {
    const currentVehicle = await findVehicleOrThrow(context.tenantId, vehicleId);
    const normalizedPlate = normalizePlate(input.plate);

    if (input.currentDriverId) {
      await ensureDriverBelongsToTenant(context.tenantId, input.currentDriverId);
    }

    if (normalizedPlate !== currentVehicle.plate) {
      await ensureUniquePlate(context.tenantId, normalizedPlate, vehicleId);
    }

    if (input.currentMileage < currentVehicle.currentMileage) {
      throw new ValidationError('Nova quilometragem não pode ser menor que a atual');
    }

    if (input.status) {
      validateStatusTransition(currentVehicle.status, input.status);
    }

    return prisma.$transaction(async (tx) => {
      const updateData: Prisma.VehicleUncheckedUpdateInput = {
        plate: normalizedPlate,
        brand: input.brand.trim(),
        model: input.model.trim(),
        year: input.year,
        yearModel: input.yearModel,
        fuelType: input.fuelType,
        category: input.category,
        currentMileage: input.currentMileage,
        expectedConsumption: input.expectedConsumption,
      };

      if ('renavam' in input) {
        updateData.renavam = normalizeOptionalString(input.renavam);
      }

      if ('chassis' in input) {
        updateData.chassis = normalizeOptionalString(input.chassis);
      }

      if ('color' in input) {
        updateData.color = normalizeOptionalString(input.color);
      }

      if ('status' in input) {
        updateData.status = input.status ?? currentVehicle.status;
      }

      if ('acquisitionDate' in input) {
        updateData.acquisitionDate = input.acquisitionDate ?? null;
      }

      if ('acquisitionValue' in input) {
        updateData.acquisitionValue = input.acquisitionValue ?? null;
      }

      if ('photos' in input) {
        updateData.photos = normalizeOptionalJsonArray(input.photos);
      }

      if ('notes' in input) {
        updateData.notes = normalizeOptionalString(input.notes);
      }

      if ('currentDriverId' in input) {
        updateData.currentDriverId = input.currentDriverId ?? null;
      }

      const vehicle = await tx.vehicle.update({
        where: {
          id: vehicleId,
        },
        data: updateData,
        include: vehicleInclude,
      });

      await createAuditLog(tx, context, {
        action: 'VEHICLE_UPDATED',
        entityId: vehicle.id,
        changes: {
          before: currentVehicle,
          after: vehicle,
        },
      });

      return vehicle;
    });
  }

  async updateVehicleStatus(
    context: VehicleActorContext,
    vehicleId: string,
    input: VehicleStatusUpdateInput,
  ): Promise<VehicleRecord> {
    const currentVehicle = await findVehicleOrThrow(context.tenantId, vehicleId);

    validateStatusTransition(currentVehicle.status, input.status);

    if (currentVehicle.status === input.status) {
      return currentVehicle;
    }

    return prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.update({
        where: {
          id: vehicleId,
        },
        data: {
          status: input.status,
        },
        include: vehicleInclude,
      });

      await createAuditLog(tx, context, {
        action: 'VEHICLE_STATUS_CHANGED',
        entityId: vehicle.id,
        changes: {
          before: {
            status: currentVehicle.status,
          },
          after: {
            status: vehicle.status,
          },
        },
      });

      return vehicle;
    });
  }

  async updateVehicleMileage(
    context: VehicleActorContext,
    vehicleId: string,
    input: VehicleMileageUpdateInput,
  ): Promise<VehicleRecord> {
    const currentVehicle = await findVehicleOrThrow(context.tenantId, vehicleId);

    if (input.mileage < currentVehicle.currentMileage) {
      throw new ValidationError('Nova quilometragem não pode ser menor que a atual');
    }

    if (input.mileage === currentVehicle.currentMileage) {
      return currentVehicle;
    }

    return prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.update({
        where: {
          id: vehicleId,
        },
        data: {
          currentMileage: input.mileage,
        },
        include: vehicleInclude,
      });

      await createAuditLog(tx, context, {
        action: 'VEHICLE_MILEAGE_UPDATED',
        entityId: vehicle.id,
        changes: {
          before: {
            currentMileage: currentVehicle.currentMileage,
          },
          after: {
            currentMileage: vehicle.currentMileage,
          },
        },
      });

      return vehicle;
    });
  }

  async deleteVehicle(
    context: VehicleActorContext,
    vehicleId: string,
  ): Promise<VehicleDeletionResult> {
    const vehicle = await findVehicleOrThrow(context.tenantId, vehicleId);
    const timelineCount = await prisma.auditLog.count({
      where: {
        tenantId: context.tenantId,
        entity: VEHICLE_ENTITY,
        entityId: vehicleId,
      },
    });

    const shouldHardDelete = timelineCount <= 1 && vehicle.currentMileage === 0;

    if (shouldHardDelete) {
      return prisma.$transaction(async (tx) => {
        await tx.auditLog.deleteMany({
          where: {
            tenantId: context.tenantId,
            entity: VEHICLE_ENTITY,
            entityId: vehicleId,
          },
        });

        await tx.vehicle.delete({
          where: {
            id: vehicleId,
          },
        });

        return {
          deleted: true,
          mode: 'hard',
          vehicleId,
        };
      });
    }

    if (vehicle.status !== VehicleStatus.DECOMMISSIONED) {
      await prisma.$transaction(async (tx) => {
        await tx.vehicle.update({
          where: {
            id: vehicleId,
          },
          data: {
            status: VehicleStatus.DECOMMISSIONED,
          },
        });

        await createAuditLog(tx, context, {
          action: 'VEHICLE_DELETED',
          entityId: vehicleId,
          changes: {
            before: {
              status: vehicle.status,
            },
            after: {
              status: VehicleStatus.DECOMMISSIONED,
            },
          },
        });
      });
    }

    return {
      deleted: true,
      mode: 'soft',
      vehicleId,
    };
  }

  async importVehicles(
    context: VehicleActorContext,
    file?: Express.Multer.File,
  ): Promise<VehicleImportResult<VehicleRecord>> {
    const rows = await parseVehicleImportFile(file as Express.Multer.File);
    const errors: VehicleImportError[] = [];
    const parsedRows: ImportPreparedRow[] = [];

    rows.forEach((row, index) => {
      const parseResult = createVehicleBodySchema.safeParse(row);
      const rowNumber = index + 2;
      const rawPlate = typeof row['plate'] === 'string' ? normalizePlate(row['plate']) : undefined;

      if (!parseResult.success) {
        errors.push({
          row: rowNumber,
          plate: rawPlate,
          errors: flattenValidationIssues(parseResult.error),
        });
        return;
      }

      parsedRows.push({
        row: rowNumber,
        input: parseResult.data,
        normalizedPlate: normalizePlate(parseResult.data.plate),
        consumesPlanSlot: parseResult.data.status !== VehicleStatus.DECOMMISSIONED,
      });
    });

    const duplicateRows = new Set<number>();
    const rowsByPlate = new Map<string, ImportPreparedRow[]>();

    for (const parsedRow of parsedRows) {
      const items = rowsByPlate.get(parsedRow.normalizedPlate) ?? [];
      items.push(parsedRow);
      rowsByPlate.set(parsedRow.normalizedPlate, items);
    }

    for (const [plate, items] of rowsByPlate.entries()) {
      if (items.length <= 1) {
        continue;
      }

      items.forEach((item) => {
        duplicateRows.add(item.row);
        errors.push({
          row: item.row,
          plate,
          errors: ['Placa duplicada no arquivo de importação'],
        });
      });
    }

    const uniqueRows = parsedRows.filter((item) => !duplicateRows.has(item.row));

    const existingVehicles =
      uniqueRows.length > 0
        ? await prisma.vehicle.findMany({
            where: {
              tenantId: context.tenantId,
              plate: {
                in: uniqueRows.map((item) => item.normalizedPlate),
              },
            },
            select: {
              plate: true,
            },
          })
        : [];

    const existingPlateSet = new Set(existingVehicles.map((item) => item.plate));
    const rowsReadyForImport: ImportPreparedRow[] = [];

    for (const parsedRow of uniqueRows) {
      if (existingPlateSet.has(parsedRow.normalizedPlate)) {
        errors.push({
          row: parsedRow.row,
          plate: parsedRow.normalizedPlate,
          errors: ['Placa já cadastrada neste tenant'],
        });
        continue;
      }

      if (parsedRow.input.currentDriverId) {
        try {
          await ensureDriverBelongsToTenant(context.tenantId, parsedRow.input.currentDriverId);
        } catch (error) {
          errors.push({
            row: parsedRow.row,
            plate: parsedRow.normalizedPlate,
            errors: [error instanceof Error ? error.message : 'Motorista atual inválido'],
          });
          continue;
        }
      }

      rowsReadyForImport.push(parsedRow);
    }

    const maxVehicles = getPlanVehicleLimit(context.tenantPlan);

    if (Number.isFinite(maxVehicles)) {
      const currentCount = await prisma.vehicle.count({
        where: {
          tenantId: context.tenantId,
          status: {
            not: VehicleStatus.DECOMMISSIONED,
          },
        },
      });

      let usedSlots = 0;
      const limitedRows: ImportPreparedRow[] = [];

      for (const parsedRow of rowsReadyForImport) {
        if (!parsedRow.consumesPlanSlot) {
          limitedRows.push(parsedRow);
          continue;
        }

        if (currentCount + usedSlots + 1 > maxVehicles) {
          errors.push({
            row: parsedRow.row,
            plate: parsedRow.normalizedPlate,
            errors: [`Limite do plano atingido (${maxVehicles} veículos)`],
          });
          continue;
        }

        usedSlots += 1;
        limitedRows.push(parsedRow);
      }

      rowsReadyForImport.splice(0, rowsReadyForImport.length, ...limitedRows);
    }

    const items =
      rowsReadyForImport.length === 0
        ? []
        : await prisma.$transaction(async (tx) => {
            const createdVehicles: VehicleRecord[] = [];

            for (const parsedRow of rowsReadyForImport) {
              const vehicle = await tx.vehicle.create({
                data: buildVehicleCreateData(context.tenantId, parsedRow.input),
                include: vehicleInclude,
              });

              await createAuditLog(tx, context, {
                action: 'VEHICLE_IMPORTED',
                entityId: vehicle.id,
                changes: {
                  source: 'import',
                  row: parsedRow.row,
                  after: vehicle,
                },
              });

              createdVehicles.push(vehicle);
            }

            return createdVehicles;
          });

    return {
      importedCount: items.length,
      errorCount: errors.length,
      items,
      errors: errors.sort((left, right) => left.row - right.row),
    };
  }

  async exportVehicles(
    context: VehicleActorContext,
    query: VehicleExportQueryInput,
  ): Promise<{ fileName: string; content: string }> {
    const items = await prisma.vehicle.findMany({
      where: buildVehicleWhere(context.tenantId, query),
      include: vehicleInclude,
      orderBy: buildVehicleOrderBy(query.sortBy, query.sortOrder),
    });

    return {
      fileName: `${DEFAULT_EXPORT_FILE_PREFIX}-${new Date().toISOString().slice(0, 10)}.csv`,
      content: buildVehicleCsv(items),
    };
  }

  async getVehicleStats(
    context: VehicleActorContext,
    query: VehicleStatsQueryInput,
  ): Promise<VehicleStatsResponse> {
    const where = buildVehicleWhere(context.tenantId, query);

    const vehicles = await prisma.vehicle.findMany({
      where,
      select: {
        status: true,
        category: true,
        fuelType: true,
        currentMileage: true,
        yearModel: true,
      },
    });

    const counters = createVehicleCounters();
    const currentYear = new Date().getFullYear();

    vehicles.forEach((vehicle) => {
      counters.byStatus[vehicle.status] += 1;
      counters.byCategory[vehicle.category] += 1;
      counters.byFuelType[vehicle.fuelType] += 1;
    });

    const totalVehicles = vehicles.length;
    const averageFleetAge =
      vehicles.length === 0
        ? 0
        : roundToTwoDecimals(
            vehicles.reduce((sum, item) => sum + (currentYear - item.yearModel), 0) /
              vehicles.length,
          );

    return {
      total: totalVehicles,
      byStatus: counters.byStatus,
      byCategory: counters.byCategory,
      byFuelType: counters.byFuelType,
      averageFleetAge,
      averageMileage:
        vehicles.length === 0
          ? 0
          : roundToTwoDecimals(
              vehicles.reduce((sum, item) => sum + item.currentMileage, 0) / vehicles.length,
            ),
    };
  }
}

export const vehiclesService = new VehiclesService();
