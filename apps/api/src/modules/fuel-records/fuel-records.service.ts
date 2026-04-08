import { Prisma } from '@frota-leve/database';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors';
import type {
  FuelRecordActorContext,
  FuelRecordDeletionResult,
  FuelRecordListResponse,
  FuelRecordRankingResponse,
  FuelRecordStatsResponse,
  FuelRecordWithRelations,
} from './fuel-records.types';
import type {
  FuelRecordCreateInput,
  FuelRecordListQueryInput,
  FuelRecordRankingQueryInput,
  FuelRecordReplaceInput,
  FuelRecordStatsQueryInput,
} from './fuel-records.validators';

const FUEL_RECORD_ENTITY = 'FuelRecord';
const ANOMALY_THRESHOLD = 0.6; // km/l < 60% of average → anomaly
const AVERAGE_CONSUMPTION_LOOKBACK = 20; // last N full-tank records for rolling average

// ─── Prisma select/include ────────────────────────────────────────────────────

const fuelRecordInclude = {
  vehicle: {
    select: { id: true, plate: true, brand: true, model: true, year: true },
  },
  driver: {
    select: { id: true, name: true, cpf: true },
  },
} satisfies Prisma.FuelRecordInclude;

type FuelRecordRecord = Prisma.FuelRecordGetPayload<{
  include: typeof fuelRecordInclude;
}>;

type TransactionClient = Prisma.TransactionClient;
type FuelRecordQueryClient = Pick<TransactionClient, 'fuelRecord'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toAuditChanges(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value == null) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildDateFilter(dateFrom?: Date, dateTo?: Date): Prisma.DateTimeFilter | undefined {
  if (!dateFrom && !dateTo) return undefined;
  return {
    ...(dateFrom ? { gte: dateFrom } : {}),
    ...(dateTo ? { lte: dateTo } : {}),
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class FuelRecordsService {
  // ─── List ──────────────────────────────────────────────────────────────────

  async listFuelRecords(
    ctx: FuelRecordActorContext,
    query: FuelRecordListQueryInput,
  ): Promise<FuelRecordListResponse<FuelRecordWithRelations>> {
    const { tenantId } = ctx;
    const {
      vehicleId,
      driverId,
      fuelType,
      gasStation,
      anomaly,
      dateFrom,
      dateTo,
      page,
      pageSize,
      sortBy,
      sortOrder,
    } = query;

    const dateFilter = buildDateFilter(dateFrom, dateTo);

    const where: Prisma.FuelRecordWhereInput = {
      tenantId,
      ...(vehicleId ? { vehicleId } : {}),
      ...(driverId ? { driverId } : {}),
      ...(fuelType ? { fuelType } : {}),
      ...(typeof anomaly === 'boolean' ? { anomaly } : {}),
      ...(gasStation ? { gasStation: { contains: gasStation, mode: 'insensitive' } } : {}),
      ...(dateFilter ? { date: dateFilter } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.fuelRecord.findMany({
        where,
        include: fuelRecordInclude,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.fuelRecord.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: items.map(this.toFuelRecordResponse),
      hasNext: page < totalPages,
      meta: { page, pageSize, total, totalPages },
    };
  }

  // ─── Get by ID ─────────────────────────────────────────────────────────────

  async getFuelRecordById(
    ctx: FuelRecordActorContext,
    id: string,
  ): Promise<FuelRecordWithRelations> {
    const record = await prisma.fuelRecord.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: fuelRecordInclude,
    });

    if (!record) {
      throw new NotFoundError('Registro de abastecimento não encontrado');
    }

    return this.toFuelRecordResponse(record);
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  async createFuelRecord(
    ctx: FuelRecordActorContext,
    input: FuelRecordCreateInput,
  ): Promise<FuelRecordWithRelations> {
    const { tenantId, userId, ipAddress, userAgent } = ctx;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: input.vehicleId, tenantId },
    });
    if (!vehicle) {
      throw new NotFoundError('Veículo não encontrado');
    }

    if (input.driverId) {
      const driver = await prisma.driver.findFirst({
        where: { id: input.driverId, tenantId },
      });
      if (!driver) {
        throw new NotFoundError('Motorista não encontrado');
      }
    }

    // Calculate km/l if full tank and there is a previous full-tank record
    let kmPerLiter: number | null = null;
    let anomaly = false;
    let anomalyReason: string | null = null;

    if (input.fullTank) {
      const previousFullTank = await this.findPreviousFullTankRecord(
        prisma,
        tenantId,
        input.vehicleId,
        input.date,
        input.mileage,
      );

      if (previousFullTank && previousFullTank.mileage < input.mileage) {
        const distanceKm = input.mileage - previousFullTank.mileage;
        kmPerLiter = distanceKm / input.liters;

        // Anomaly detection — compare against vehicle average consumption
        if (vehicle.averageConsumption && vehicle.averageConsumption > 0) {
          const threshold = vehicle.averageConsumption * ANOMALY_THRESHOLD;
          if (kmPerLiter < threshold) {
            anomaly = true;
            anomalyReason = `km/l calculado (${kmPerLiter.toFixed(2)}) abaixo de 60% da média histórica (${vehicle.averageConsumption.toFixed(2)})`;
          }
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.fuelRecord.create({
        data: {
          tenantId,
          vehicleId: input.vehicleId,
          driverId: input.driverId ?? null,
          date: input.date,
          mileage: input.mileage,
          liters: input.liters,
          pricePerLiter: input.pricePerLiter,
          totalCost: input.totalCost,
          fuelType: input.fuelType,
          fullTank: input.fullTank,
          gasStation: input.gasStation ?? null,
          notes: input.notes ?? null,
          receiptUrl: input.receiptUrl ?? null,
          kmPerLiter,
          anomaly,
          anomalyReason,
          createdByUserId: userId,
        },
        include: fuelRecordInclude,
      });

      await this.bumpVehicleMileageIfNeeded(tx, vehicle.id, input.mileage);
      await this.recomputeVehicleAverageConsumption(tx, vehicle.id);

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'FUEL_RECORD_CREATED',
          entity: FUEL_RECORD_ENTITY,
          entityId: created.id,
          changes: toAuditChanges({
            vehicleId: input.vehicleId,
            driverId: input.driverId ?? null,
            mileage: input.mileage,
            liters: input.liters,
            totalCost: input.totalCost,
            kmPerLiter,
            anomaly,
          }),
          ipAddress,
          userAgent,
        },
      });

      return created;
    });

    return this.toFuelRecordResponse(result);
  }

  // ─── Replace ───────────────────────────────────────────────────────────────

  async replaceFuelRecord(
    ctx: FuelRecordActorContext,
    id: string,
    input: FuelRecordReplaceInput,
  ): Promise<FuelRecordWithRelations> {
    const { tenantId, userId, ipAddress, userAgent } = ctx;

    const existing = await prisma.fuelRecord.findFirst({
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundError('Registro de abastecimento não encontrado');
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: input.vehicleId, tenantId },
    });
    if (!vehicle) {
      throw new NotFoundError('Veículo não encontrado');
    }

    if (input.driverId) {
      const driver = await prisma.driver.findFirst({
        where: { id: input.driverId, tenantId },
      });
      if (!driver) {
        throw new NotFoundError('Motorista não encontrado');
      }
    }

    // Recalculate km/l
    let kmPerLiter: number | null = null;
    let anomaly = false;
    let anomalyReason: string | null = null;

    if (input.fullTank) {
      const previousFullTank = await this.findPreviousFullTankRecord(
        prisma,
        tenantId,
        input.vehicleId,
        input.date,
        input.mileage,
        id,
      );

      if (previousFullTank && previousFullTank.mileage < input.mileage) {
        const distanceKm = input.mileage - previousFullTank.mileage;
        kmPerLiter = distanceKm / input.liters;

        if (vehicle.averageConsumption && vehicle.averageConsumption > 0) {
          const threshold = vehicle.averageConsumption * ANOMALY_THRESHOLD;
          if (kmPerLiter < threshold) {
            anomaly = true;
            anomalyReason = `km/l calculado (${kmPerLiter.toFixed(2)}) abaixo de 60% da média histórica (${vehicle.averageConsumption.toFixed(2)})`;
          }
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.fuelRecord.update({
        where: { id },
        data: {
          vehicleId: input.vehicleId,
          driverId: input.driverId ?? null,
          date: input.date,
          mileage: input.mileage,
          liters: input.liters,
          pricePerLiter: input.pricePerLiter,
          totalCost: input.totalCost,
          fuelType: input.fuelType,
          fullTank: input.fullTank,
          gasStation: input.gasStation ?? null,
          notes: input.notes ?? null,
          receiptUrl: input.receiptUrl ?? null,
          kmPerLiter,
          anomaly,
          anomalyReason,
        },
        include: fuelRecordInclude,
      });

      await this.bumpVehicleMileageIfNeeded(tx, vehicle.id, input.mileage);

      const affectedVehicleIds = new Set([existing.vehicleId, input.vehicleId]);
      for (const vehicleId of affectedVehicleIds) {
        await this.recomputeVehicleAverageConsumption(tx, vehicleId);
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'FUEL_RECORD_UPDATED',
          entity: FUEL_RECORD_ENTITY,
          entityId: id,
          changes: toAuditChanges({
            before: existing,
            after: {
              mileage: input.mileage,
              liters: input.liters,
              totalCost: input.totalCost,
              kmPerLiter,
              anomaly,
            },
          }),
          ipAddress,
          userAgent,
        },
      });

      return updated;
    });

    return this.toFuelRecordResponse(result);
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async deleteFuelRecord(
    ctx: FuelRecordActorContext,
    id: string,
  ): Promise<FuelRecordDeletionResult> {
    const { tenantId, userId, ipAddress, userAgent } = ctx;

    const record = await prisma.fuelRecord.findFirst({
      where: { id, tenantId },
    });
    if (!record) {
      throw new NotFoundError('Registro de abastecimento não encontrado');
    }

    await prisma.$transaction(async (tx) => {
      await tx.fuelRecord.delete({ where: { id } });
      await this.recomputeVehicleAverageConsumption(tx, record.vehicleId);

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'FUEL_RECORD_DELETED',
          entity: FUEL_RECORD_ENTITY,
          entityId: id,
          changes: toAuditChanges({
            vehicleId: record.vehicleId,
            mileage: record.mileage,
            totalCost: record.totalCost,
          }),
          ipAddress,
          userAgent,
        },
      });
    });

    return { deleted: true, fuelRecordId: id };
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  async getFuelRecordStats(
    ctx: FuelRecordActorContext,
    query: FuelRecordStatsQueryInput,
  ): Promise<FuelRecordStatsResponse> {
    const { tenantId } = ctx;
    const { vehicleId, driverId, fuelType, gasStation, anomaly, dateFrom, dateTo } = query;

    const dateFilter = buildDateFilter(dateFrom, dateTo);

    const where: Prisma.FuelRecordWhereInput = {
      tenantId,
      ...(vehicleId ? { vehicleId } : {}),
      ...(driverId ? { driverId } : {}),
      ...(fuelType ? { fuelType } : {}),
      ...(typeof anomaly === 'boolean' ? { anomaly } : {}),
      ...(gasStation ? { gasStation: { contains: gasStation, mode: 'insensitive' } } : {}),
      ...(dateFilter ? { date: dateFilter } : {}),
    };

    const [aggregate, anomalyCount] = await Promise.all([
      prisma.fuelRecord.aggregate({
        where,
        _count: { id: true },
        _sum: { totalCost: true, liters: true },
        _avg: { kmPerLiter: true, pricePerLiter: true },
      }),
      prisma.fuelRecord.count({ where: { ...where, anomaly: true } }),
    ]);

    const totalRecords = aggregate._count.id;
    const totalCost = aggregate._sum.totalCost ?? 0;
    const totalLiters = aggregate._sum.liters ?? 0;
    const averageKmPerLiter = aggregate._avg.kmPerLiter ?? null;
    const averagePricePerLiter = aggregate._avg.pricePerLiter ?? null;

    // costPerKm: compute from mileage span if vehicleId is scoped
    let costPerKm: number | null = null;
    if (totalRecords > 1) {
      const [first, last] = await Promise.all([
        prisma.fuelRecord.findFirst({
          where,
          orderBy: { mileage: 'asc' },
          select: { mileage: true },
        }),
        prisma.fuelRecord.findFirst({
          where,
          orderBy: { mileage: 'desc' },
          select: { mileage: true },
        }),
      ]);
      if (first && last && last.mileage > first.mileage) {
        costPerKm = totalCost / (last.mileage - first.mileage);
      }
    }

    return {
      totalRecords,
      totalCost,
      totalLiters,
      averageKmPerLiter,
      averagePricePerLiter,
      costPerKm,
      anomalyCount,
    };
  }

  // ─── Ranking ───────────────────────────────────────────────────────────────

  async getFuelRecordRanking(
    ctx: FuelRecordActorContext,
    query: FuelRecordRankingQueryInput,
  ): Promise<FuelRecordRankingResponse> {
    const { tenantId } = ctx;
    const { vehicleId, driverId, fuelType, gasStation, anomaly, dateFrom, dateTo, limit } = query;

    const dateFilter = buildDateFilter(dateFrom, dateTo);

    const where: Prisma.FuelRecordWhereInput = {
      tenantId,
      kmPerLiter: { not: null },
      ...(vehicleId ? { vehicleId } : {}),
      ...(driverId ? { driverId } : {}),
      ...(fuelType ? { fuelType } : {}),
      ...(typeof anomaly === 'boolean' ? { anomaly } : {}),
      ...(gasStation ? { gasStation: { contains: gasStation, mode: 'insensitive' } } : {}),
      ...(dateFilter ? { date: dateFilter } : {}),
    };

    // Aggregate per vehicle using raw groupBy
    const grouped = await prisma.fuelRecord.groupBy({
      by: ['vehicleId'],
      where,
      _avg: { kmPerLiter: true },
      _count: { id: true },
      _sum: { totalCost: true, liters: true },
      orderBy: { _avg: { kmPerLiter: 'desc' } },
    });

    if (grouped.length === 0) {
      return { best: [], worst: [] };
    }

    const vehicleIds = grouped.map((g) => g.vehicleId);
    const vehicles = await prisma.vehicle.findMany({
      where: { tenantId, id: { in: vehicleIds } },
      select: { id: true, plate: true, brand: true, model: true, year: true },
    });
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

    const items = grouped
      .filter((g) => g._avg.kmPerLiter !== null)
      .map((g) => {
        const v = vehicleMap.get(g.vehicleId);
        return {
          vehicleId: g.vehicleId,
          plate: v?.plate ?? '',
          brand: v?.brand ?? '',
          model: v?.model ?? '',
          year: v?.year ?? 0,
          averageKmPerLiter: g._avg.kmPerLiter as number,
          totalRecords: g._count.id,
          totalCost: g._sum.totalCost ?? 0,
          totalLiters: g._sum.liters ?? 0,
        };
      });

    const best = items.slice(0, limit);
    const worst = [...items].reverse().slice(0, limit);

    return { best, worst };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async findPreviousFullTankRecord(
    db: FuelRecordQueryClient,
    tenantId: string,
    vehicleId: string,
    date: Date,
    mileage: number,
    excludeId?: string,
  ) {
    return db.fuelRecord.findFirst({
      where: {
        tenantId,
        vehicleId,
        fullTank: true,
        date: { lte: date },
        mileage: { lt: mileage },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      orderBy: [{ date: 'desc' }, { mileage: 'desc' }],
      select: { mileage: true },
    });
  }

  private async bumpVehicleMileageIfNeeded(
    tx: TransactionClient,
    vehicleId: string,
    newMileage: number,
  ): Promise<void> {
    const vehicle = await tx.vehicle.findUnique({
      where: { id: vehicleId },
      select: { currentMileage: true },
    });

    if (!vehicle) return;

    if (newMileage > vehicle.currentMileage) {
      await tx.vehicle.update({
        where: { id: vehicleId },
        data: { currentMileage: newMileage },
      });
    }
  }

  private async recomputeVehicleAverageConsumption(
    tx: TransactionClient,
    vehicleId: string,
  ): Promise<void> {
    const recentRecords = await tx.fuelRecord.findMany({
      where: { vehicleId, fullTank: true, kmPerLiter: { not: null } },
      orderBy: [{ date: 'desc' }, { mileage: 'desc' }],
      take: AVERAGE_CONSUMPTION_LOOKBACK,
      select: { kmPerLiter: true },
    });

    const values = recentRecords
      .map((record) => record.kmPerLiter)
      .filter((value): value is number => value !== null);

    await tx.vehicle.update({
      where: { id: vehicleId },
      data: {
        averageConsumption:
          values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
      },
    });
  }

  private toFuelRecordResponse(record: FuelRecordRecord): FuelRecordWithRelations {
    return {
      id: record.id,
      tenantId: record.tenantId,
      vehicleId: record.vehicleId,
      driverId: record.driverId,
      date: record.date,
      mileage: record.mileage,
      liters: record.liters,
      pricePerLiter: record.pricePerLiter,
      totalCost: record.totalCost,
      fuelType: record.fuelType,
      fullTank: record.fullTank,
      gasStation: record.gasStation,
      notes: record.notes,
      receiptUrl: record.receiptUrl,
      kmPerLiter: record.kmPerLiter,
      anomaly: record.anomaly,
      anomalyReason: record.anomalyReason,
      createdByUserId: record.createdByUserId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      vehicle: record.vehicle,
      driver: record.driver,
    };
  }
}

export const fuelRecordsService = new FuelRecordsService();
