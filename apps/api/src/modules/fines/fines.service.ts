import { Prisma } from '@frota-leve/database';
import type {
  FineStatus as DatabaseFineStatus,
  FineSeverity as DatabaseFineSeverity,
} from '@frota-leve/database';
import type { FineSeverity } from '@frota-leve/shared';
import { FineStatus } from '@frota-leve/shared';
import { prisma } from '../../config/database';
import { NotFoundError, ValidationError } from '../../shared/errors';
import type {
  FineActorContext,
  FineDeletionResult,
  FineListResponse,
  FineStatsResponse,
  FineWithRelations,
} from './fines.types';
import type {
  CreateFineInput,
  FineStatsQueryInput,
  ListFinesQueryInput,
  UpdateFineInput,
} from './fines.validators';

const FINE_ENTITY = 'Fine';

const fineInclude = {
  vehicle: {
    select: {
      id: true,
      plate: true,
      brand: true,
      model: true,
      year: true,
    },
  },
  driver: {
    select: {
      id: true,
      name: true,
      cpf: true,
    },
  },
} satisfies Prisma.FineInclude;

type FineRecord = Prisma.FineGetPayload<{ include: typeof fineInclude }>;

// Transições de status permitidas
const ALLOWED_TRANSITIONS: Record<FineStatus, FineStatus[]> = {
  [FineStatus.PENDING]: [FineStatus.DRIVER_IDENTIFIED, FineStatus.APPEALED, FineStatus.PAID],
  [FineStatus.DRIVER_IDENTIFIED]: [
    FineStatus.APPEALED,
    FineStatus.PAID,
    FineStatus.PAYROLL_DEDUCTED,
  ],
  [FineStatus.APPEALED]: [FineStatus.PAID],
  [FineStatus.PAID]: [],
  [FineStatus.PAYROLL_DEDUCTED]: [],
};

function toDatabaseFineStatus(value: FineStatus): DatabaseFineStatus {
  return value as unknown as DatabaseFineStatus;
}

function toDatabaseFineSeverity(value: FineSeverity): DatabaseFineSeverity {
  return value as unknown as DatabaseFineSeverity;
}

function toAuditChanges(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value == null) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function assertValidTransition(current: FineStatus, next: FineStatus): void {
  if (current === next) return;

  if (!ALLOWED_TRANSITIONS[current].includes(next)) {
    throw new ValidationError(`Transição de status inválida: ${current} → ${next}`);
  }
}

async function ensureVehicleBelongsToTenant(tenantId: string, vehicleId: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenantId },
    select: { id: true },
  });

  if (!vehicle) throw new NotFoundError('Veículo não encontrado');
  return vehicle;
}

async function ensureDriverBelongsToTenant(tenantId: string, driverId: string | null | undefined) {
  if (!driverId) return null;

  const driver = await prisma.driver.findFirst({
    where: { id: driverId, tenantId },
    select: { id: true },
  });

  if (!driver) throw new NotFoundError('Motorista não encontrado');
  return driver;
}

export class FinesService {
  async listFines(
    context: FineActorContext,
    query: ListFinesQueryInput,
  ): Promise<FineListResponse<FineWithRelations>> {
    const { tenantId } = context;
    const {
      vehicleId,
      driverId,
      status,
      severity,
      search,
      dateFrom,
      dateTo,
      page,
      pageSize,
      sortBy,
      sortOrder,
    } = query;

    const where: Prisma.FineWhereInput = {
      tenantId,
      ...(vehicleId ? { vehicleId } : {}),
      ...(driverId ? { driverId } : {}),
      ...(status ? { status: toDatabaseFineStatus(status) } : {}),
      ...(severity ? { severity: toDatabaseFineSeverity(severity) } : {}),
      ...(search
        ? {
            OR: [
              { autoNumber: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { location: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(dateFrom || dateTo
        ? { date: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.fine.findMany({
        where,
        include: fineInclude,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.fine.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: items.map((item) => this.toFineResponse(item)),
      hasNext: page < totalPages,
      meta: { page, pageSize, total, totalPages },
    };
  }

  async getFineById(context: FineActorContext, fineId: string): Promise<FineWithRelations> {
    const fine = await prisma.fine.findFirst({
      where: { id: fineId, tenantId: context.tenantId },
      include: fineInclude,
    });

    if (!fine) throw new NotFoundError('Multa não encontrada');

    return this.toFineResponse(fine);
  }

  async createFine(context: FineActorContext, input: CreateFineInput): Promise<FineWithRelations> {
    const { tenantId, userId, ipAddress, userAgent } = context;

    await ensureVehicleBelongsToTenant(tenantId, input.vehicleId);
    await ensureDriverBelongsToTenant(tenantId, input.driverId ?? null);

    const created = await prisma.$transaction(async (tx) => {
      const fine = await tx.fine.create({
        data: {
          tenantId,
          vehicleId: input.vehicleId,
          driverId: input.driverId ?? null,
          date: input.date,
          autoNumber: input.autoNumber.trim(),
          location: input.location.trim(),
          description: input.description.trim(),
          severity: toDatabaseFineSeverity(input.severity),
          points: input.points,
          amount: input.amount,
          discountAmount: input.discountAmount ?? null,
          dueDate: input.dueDate,
          status: toDatabaseFineStatus(FineStatus.PENDING),
          payrollDeduction: input.payrollDeduction,
          notes: input.notes?.trim() ?? null,
          fileUrl: input.fileUrl ?? null,
        },
        include: fineInclude,
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'FINE_CREATED',
          entity: FINE_ENTITY,
          entityId: fine.id,
          changes: toAuditChanges({
            vehicleId: input.vehicleId,
            driverId: input.driverId ?? null,
            autoNumber: input.autoNumber,
            severity: input.severity,
            amount: input.amount,
            status: FineStatus.PENDING,
          }),
          ipAddress,
          userAgent,
        },
      });

      return fine;
    });

    return this.toFineResponse(created);
  }

  async updateFine(
    context: FineActorContext,
    fineId: string,
    input: UpdateFineInput,
  ): Promise<FineWithRelations> {
    const { tenantId, userId, ipAddress, userAgent } = context;

    const current = await prisma.fine.findFirst({
      where: { id: fineId, tenantId },
      include: fineInclude,
    });

    if (!current) throw new NotFoundError('Multa não encontrada');

    await ensureVehicleBelongsToTenant(tenantId, input.vehicleId);
    await ensureDriverBelongsToTenant(tenantId, input.driverId ?? null);

    const currentStatus = current.status as unknown as FineStatus;
    const nextStatus = input.status;

    assertValidTransition(currentStatus, nextStatus);

    const updated = await prisma.$transaction(async (tx) => {
      const fine = await tx.fine.update({
        where: { id: fineId },
        data: {
          vehicleId: input.vehicleId,
          driverId: input.driverId ?? null,
          date: input.date,
          autoNumber: input.autoNumber.trim(),
          location: input.location.trim(),
          description: input.description.trim(),
          severity: toDatabaseFineSeverity(input.severity),
          points: input.points,
          amount: input.amount,
          discountAmount: input.discountAmount ?? null,
          dueDate: input.dueDate,
          status: toDatabaseFineStatus(nextStatus),
          payrollDeduction: input.payrollDeduction,
          notes: input.notes?.trim() ?? null,
          fileUrl: input.fileUrl ?? null,
        },
        include: fineInclude,
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'FINE_UPDATED',
          entity: FINE_ENTITY,
          entityId: fineId,
          changes: toAuditChanges({
            before: { status: currentStatus, driverId: current.driverId, amount: current.amount },
            after: { status: nextStatus, driverId: input.driverId ?? null, amount: input.amount },
          }),
          ipAddress,
          userAgent,
        },
      });

      return fine;
    });

    return this.toFineResponse(updated);
  }

  async deleteFine(context: FineActorContext, fineId: string): Promise<FineDeletionResult> {
    const { tenantId, userId, ipAddress, userAgent } = context;

    const fine = await prisma.fine.findFirst({
      where: { id: fineId, tenantId },
    });

    if (!fine) throw new NotFoundError('Multa não encontrada');

    const currentStatus = fine.status as unknown as FineStatus;

    if (currentStatus !== FineStatus.PENDING) {
      throw new ValidationError('Apenas multas pendentes podem ser excluídas');
    }

    const auditCount = await prisma.auditLog.count({
      where: { tenantId, entity: FINE_ENTITY, entityId: fineId },
    });

    // Hard delete se só tem o registro de criação
    if (auditCount <= 1) {
      await prisma.$transaction(async (tx) => {
        await tx.auditLog.deleteMany({
          where: { tenantId, entity: FINE_ENTITY, entityId: fineId },
        });
        await tx.fine.delete({ where: { id: fineId } });
      });

      return { deleted: true, mode: 'hard', fineId };
    }

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'FINE_DELETED',
          entity: FINE_ENTITY,
          entityId: fineId,
          changes: toAuditChanges({ autoNumber: fine.autoNumber, amount: fine.amount }),
          ipAddress,
          userAgent,
        },
      });

      await tx.fine.delete({ where: { id: fineId } });
    });

    return { deleted: true, mode: 'soft', fineId };
  }

  async getStats(
    context: FineActorContext,
    query: FineStatsQueryInput,
  ): Promise<FineStatsResponse> {
    const { tenantId } = context;
    const { vehicleId, driverId, dateFrom, dateTo, granularity } = query;

    const where: Prisma.FineWhereInput = {
      tenantId,
      ...(vehicleId ? { vehicleId } : {}),
      ...(driverId ? { driverId } : {}),
      ...(dateFrom || dateTo
        ? { date: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
        : {}),
    };

    const fines = await prisma.fine.findMany({
      where,
      select: {
        date: true,
        severity: true,
        status: true,
        points: true,
        amount: true,
        discountAmount: true,
        driverId: true,
        driver: { select: { id: true, name: true, cpf: true } },
      },
    });

    if (fines.length === 0) {
      return {
        summary: {
          total: 0,
          totalAmount: 0,
          totalDiscount: 0,
          netAmount: 0,
          totalPoints: 0,
          dateFrom: dateFrom ?? null,
          dateTo: dateTo ?? null,
        },
        byStatus: [],
        bySeverity: [],
        byDriver: [],
        byPeriod: [],
      };
    }

    // ── Sumário ───────────────────────────────────────────────────────────────
    const totalAmount = fines.reduce((s, f) => s + f.amount, 0);
    const totalDiscount = fines.reduce((s, f) => s + (f.discountAmount ?? 0), 0);
    const totalPoints = fines.reduce((s, f) => s + f.points, 0);

    // ── Por status ────────────────────────────────────────────────────────────
    const statusMap = new Map<string, { count: number; amount: number }>();
    for (const f of fines) {
      const key = String(f.status);
      const entry = statusMap.get(key) ?? { count: 0, amount: 0 };
      entry.count++;
      entry.amount += f.amount;
      statusMap.set(key, entry);
    }

    // ── Por gravidade ─────────────────────────────────────────────────────────
    const severityMap = new Map<string, { count: number; amount: number; points: number }>();
    for (const f of fines) {
      const key = String(f.severity);
      const entry = severityMap.get(key) ?? { count: 0, amount: 0, points: 0 };
      entry.count++;
      entry.amount += f.amount;
      entry.points += f.points;
      severityMap.set(key, entry);
    }

    // ── Por motorista ─────────────────────────────────────────────────────────
    const driverMap = new Map<
      string,
      {
        driverId: string | null;
        driverName: string | null;
        driverCpf: string | null;
        count: number;
        amount: number;
        points: number;
      }
    >();
    for (const f of fines) {
      const key = f.driverId ?? '__unidentified__';
      const entry = driverMap.get(key) ?? {
        driverId: f.driverId,
        driverName: f.driver?.name ?? null,
        driverCpf: f.driver?.cpf ?? null,
        count: 0,
        amount: 0,
        points: 0,
      };
      entry.count++;
      entry.amount += f.amount;
      entry.points += f.points;
      driverMap.set(key, entry);
    }

    // ── Por período ───────────────────────────────────────────────────────────
    const periodMap = new Map<string, { count: number; amount: number }>();
    for (const f of fines) {
      const d = f.date;
      const period =
        granularity === 'day'
          ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
          : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

      const entry = periodMap.get(period) ?? { count: 0, amount: 0 };
      entry.count++;
      entry.amount += f.amount;
      periodMap.set(period, entry);
    }

    const MONTH_LABELS = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];

    const byPeriod = [...periodMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, data]) => {
        let label: string;
        if (granularity === 'day') {
          const [, mm, dd] = period.split('-');
          label = `${dd}/${mm}`;
        } else {
          const [yyyy, mm] = period.split('-');
          label = `${MONTH_LABELS[Number(mm) - 1]}/${yyyy}`;
        }
        return { period, label, ...data };
      });

    return {
      summary: {
        total: fines.length,
        totalAmount,
        totalDiscount,
        netAmount: totalAmount - totalDiscount,
        totalPoints,
        dateFrom: dateFrom ?? null,
        dateTo: dateTo ?? null,
      },
      byStatus: [...statusMap.entries()].map(([status, data]) => ({ status, ...data })),
      bySeverity: [...severityMap.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([severity, data]) => ({ severity, ...data })),
      byDriver: [...driverMap.values()].sort((a, b) => b.count - a.count),
      byPeriod,
    };
  }

  private toFineResponse(record: FineRecord): FineWithRelations {
    return {
      id: record.id,
      tenantId: record.tenantId,
      vehicleId: record.vehicleId,
      driverId: record.driverId,
      date: record.date,
      autoNumber: record.autoNumber,
      location: record.location,
      description: record.description,
      severity: record.severity,
      points: record.points,
      amount: record.amount,
      discountAmount: record.discountAmount,
      dueDate: record.dueDate,
      status: record.status,
      payrollDeduction: record.payrollDeduction,
      notes: record.notes,
      fileUrl: record.fileUrl,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      vehicle: record.vehicle,
      driver: record.driver,
    };
  }
}

export const finesService = new FinesService();
