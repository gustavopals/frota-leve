import { Prisma } from '@frota-leve/database';
import { createDriverSchema } from '@frota-leve/shared';
import { prisma } from '../../config/database';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors';
import { parseDriverImportFile } from './drivers.import';
import type {
  DriverActorContext,
  DriverDeletionResult,
  DriverHistory,
  DriverImportError,
  DriverImportPreviewItem,
  DriverImportResult,
  DriverListResponse,
} from './drivers.types';
import type {
  DriverCreateInput,
  DriverImportQueryInput,
  DriverListQueryInput,
  DriverReplaceInput,
} from './drivers.validators';

const DRIVER_ENTITY = 'Driver';
const CNH_EXPIRING_DAYS = 30;

// ─── Prisma select/include ────────────────────────────────────────────────────

const driverInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  },
} satisfies Prisma.DriverInclude;

type DriverRecord = Prisma.DriverGetPayload<{ include: typeof driverInclude }>;

type DriverWithFlags = DriverRecord & { cnhExpiring: boolean };

type TransactionClient = Prisma.TransactionClient;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeCpf(value: string): string {
  return value.replace(/\D/g, '');
}

function normalizeOptionalString(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function toAuditChanges(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value == null) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Retorna true quando a CNH vence em até CNH_EXPIRING_DAYS dias */
function isCnhExpiring(cnhExpiration: Date | null): boolean {
  if (!cnhExpiration) return false;
  const today = new Date();
  const diffMs = cnhExpiration.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= CNH_EXPIRING_DAYS;
}

function toDriverWithFlags(driver: DriverRecord): DriverWithFlags {
  return {
    ...driver,
    cnhExpiring: isCnhExpiring(driver.cnhExpiration),
  };
}

function flattenValidationIssues(error: {
  issues: Array<{ path: Array<string | number>; message: string }>;
}): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  });
}

function buildDriverWhere(
  tenantId: string,
  filters: DriverListQueryInput,
  cnhExpiringBefore?: Date,
): Prisma.DriverWhereInput {
  const where: Prisma.DriverWhereInput = { tenantId };

  if (typeof filters.isActive === 'boolean') {
    where.isActive = filters.isActive;
  }

  if (filters.department) {
    where.department = { equals: filters.department, mode: 'insensitive' };
  }

  if (filters.search) {
    const term = filters.search.trim();
    const normalizedCpf = normalizeCpf(term);

    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { cpf: { contains: normalizedCpf } },
      { department: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
    ];
  }

  if (filters.cnhExpiring && cnhExpiringBefore) {
    const today = new Date();
    where.cnhExpiration = { gte: today, lte: cnhExpiringBefore };
  }

  return where;
}

async function createAuditLog(
  tx: TransactionClient,
  context: DriverActorContext,
  params: { action: string; entityId: string; changes: unknown },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId: context.tenantId,
      userId: context.userId,
      action: params.action,
      entity: DRIVER_ENTITY,
      entityId: params.entityId,
      changes: toAuditChanges(params.changes),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });
}

async function findDriverOrThrow(tenantId: string, driverId: string): Promise<DriverRecord> {
  const driver = await prisma.driver.findFirst({
    where: { id: driverId, tenantId },
    include: driverInclude,
  });

  if (!driver) throw new NotFoundError('Motorista não encontrado');
  return driver;
}

async function ensureUniqueCpf(
  tenantId: string,
  cpf: string,
  excludeDriverId?: string,
): Promise<void> {
  const existing = await prisma.driver.findFirst({
    where: {
      tenantId,
      cpf,
      ...(excludeDriverId ? { id: { not: excludeDriverId } } : {}),
    },
    select: { id: true },
  });

  if (existing) throw new ConflictError('CPF já cadastrado neste tenant');
}

async function ensureUserBelongsToTenant(tenantId: string, userId: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId, isActive: true },
    select: { id: true },
  });

  if (!user) throw new ValidationError('Usuário vinculado inválido para este tenant');
}

async function ensureUserNotAlreadyLinked(userId: string, excludeDriverId?: string): Promise<void> {
  const existing = await prisma.driver.findFirst({
    where: {
      userId,
      ...(excludeDriverId ? { id: { not: excludeDriverId } } : {}),
    },
    select: { id: true },
  });

  if (existing) throw new ConflictError('Usuário já está vinculado a outro perfil de motorista');
}

function buildDriverCreateData(
  tenantId: string,
  input: DriverCreateInput,
): Prisma.DriverUncheckedCreateInput {
  return {
    tenantId,
    name: input.name.trim(),
    cpf: normalizeCpf(input.cpf),
    phone: normalizeOptionalString(input.phone) ?? undefined,
    email: normalizeOptionalString(input.email) ?? undefined,
    birthDate: input.birthDate,
    cnhNumber: normalizeOptionalString(input.cnhNumber) ?? undefined,
    cnhCategory: input.cnhCategory,
    cnhExpiration: input.cnhExpiration,
    cnhPoints: input.cnhPoints ?? 0,
    emergencyContact: normalizeOptionalString(input.emergencyContact) ?? undefined,
    emergencyPhone: normalizeOptionalString(input.emergencyPhone) ?? undefined,
    department: normalizeOptionalString(input.department) ?? undefined,
    isActive: input.isActive ?? true,
    photoUrl: normalizeOptionalString(input.photoUrl) ?? undefined,
    hireDate: input.hireDate,
    score: input.score ?? 100,
    notes: normalizeOptionalString(input.notes) ?? undefined,
    userId: input.userId,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class DriversService {
  async listDrivers(
    context: DriverActorContext,
    query: DriverListQueryInput,
  ): Promise<DriverListResponse<DriverWithFlags>> {
    const cnhExpiringBefore = query.cnhExpiring
      ? new Date(Date.now() + CNH_EXPIRING_DAYS * 24 * 60 * 60 * 1000)
      : undefined;

    const where = buildDriverWhere(context.tenantId, query, cnhExpiringBefore);
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await prisma.$transaction([
      prisma.driver.findMany({
        where,
        include: driverInclude,
        orderBy: { [query.sortBy]: query.sortOrder } as Prisma.DriverOrderByWithRelationInput,
        skip,
        take: query.pageSize,
      }),
      prisma.driver.count({ where }),
    ]);

    return {
      items: items.map(toDriverWithFlags),
      hasNext: skip + items.length < total,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / query.pageSize), 1),
      },
    };
  }

  async getDriverById(
    context: DriverActorContext,
    driverId: string,
  ): Promise<DriverWithFlags & { history: DriverHistory }> {
    const driver = await findDriverOrThrow(context.tenantId, driverId);

    const [auditLog, assignedVehicles] = await Promise.all([
      prisma.auditLog.findMany({
        where: { tenantId: context.tenantId, entity: DRIVER_ENTITY, entityId: driverId },
        orderBy: { createdAt: 'desc' },
      }),
      // Veículos onde este motorista está atualmente alocado (via User account)
      driver.userId
        ? prisma.vehicle.findMany({
            where: { tenantId: context.tenantId, currentDriverId: driver.userId },
            select: { id: true, plate: true, brand: true, model: true, year: true, status: true },
          })
        : Promise.resolve([]),
    ]);

    const history: DriverHistory = {
      driverId,
      assignedVehicles,
      auditLog,
    };

    return { ...toDriverWithFlags(driver), history };
  }

  async createDriver(
    context: DriverActorContext,
    input: DriverCreateInput,
  ): Promise<DriverWithFlags> {
    const normalizedCpf = normalizeCpf(input.cpf);

    await ensureUniqueCpf(context.tenantId, normalizedCpf);

    if (input.userId) {
      await ensureUserBelongsToTenant(context.tenantId, input.userId);
      await ensureUserNotAlreadyLinked(input.userId);
    }

    return prisma.$transaction(async (tx) => {
      const driver = await tx.driver.create({
        data: buildDriverCreateData(context.tenantId, input),
        include: driverInclude,
      });

      await createAuditLog(tx, context, {
        action: 'DRIVER_CREATED',
        entityId: driver.id,
        changes: { after: driver },
      });

      return toDriverWithFlags(driver);
    });
  }

  async replaceDriver(
    context: DriverActorContext,
    driverId: string,
    input: DriverReplaceInput,
  ): Promise<DriverWithFlags> {
    const current = await findDriverOrThrow(context.tenantId, driverId);
    const normalizedCpf = normalizeCpf(input.cpf);

    if (normalizedCpf !== current.cpf) {
      await ensureUniqueCpf(context.tenantId, normalizedCpf, driverId);
    }

    if (input.userId && input.userId !== current.userId) {
      await ensureUserBelongsToTenant(context.tenantId, input.userId);
      await ensureUserNotAlreadyLinked(input.userId, driverId);
    }

    return prisma.$transaction(async (tx) => {
      const updateData: Prisma.DriverUncheckedUpdateInput = {
        name: input.name.trim(),
        cpf: normalizedCpf,
        phone: normalizeOptionalString(input.phone),
        email: normalizeOptionalString(input.email),
        birthDate: input.birthDate ?? null,
        cnhNumber: normalizeOptionalString(input.cnhNumber),
        cnhCategory: input.cnhCategory ?? null,
        cnhExpiration: input.cnhExpiration ?? null,
        cnhPoints: input.cnhPoints ?? 0,
        emergencyContact: normalizeOptionalString(input.emergencyContact),
        emergencyPhone: normalizeOptionalString(input.emergencyPhone),
        department: normalizeOptionalString(input.department),
        isActive: input.isActive ?? true,
        photoUrl: normalizeOptionalString(input.photoUrl),
        hireDate: input.hireDate ?? null,
        score: input.score ?? 100,
        notes: normalizeOptionalString(input.notes),
        userId: input.userId ?? null,
      };

      const driver = await tx.driver.update({
        where: { id: driverId },
        data: updateData,
        include: driverInclude,
      });

      await createAuditLog(tx, context, {
        action: 'DRIVER_UPDATED',
        entityId: driver.id,
        changes: { before: current, after: driver },
      });

      return toDriverWithFlags(driver);
    });
  }

  async deleteDriver(context: DriverActorContext, driverId: string): Promise<DriverDeletionResult> {
    const driver = await findDriverOrThrow(context.tenantId, driverId);

    const auditCount = await prisma.auditLog.count({
      where: { tenantId: context.tenantId, entity: DRIVER_ENTITY, entityId: driverId },
    });

    // Hard delete somente se não há histórico de operações
    const shouldHardDelete = auditCount <= 1;

    if (shouldHardDelete) {
      return prisma.$transaction(async (tx) => {
        await tx.auditLog.deleteMany({
          where: { tenantId: context.tenantId, entity: DRIVER_ENTITY, entityId: driverId },
        });
        await tx.driver.delete({ where: { id: driverId } });

        return { deleted: true as const, mode: 'hard' as const, driverId };
      });
    }

    // Soft delete: desativa o motorista
    if (driver.isActive) {
      return prisma.$transaction(async (tx) => {
        await tx.driver.update({
          where: { id: driverId },
          data: { isActive: false },
        });

        await createAuditLog(tx, context, {
          action: 'DRIVER_DELETED',
          entityId: driverId,
          changes: { before: { isActive: true }, after: { isActive: false } },
        });

        return { deleted: true as const, mode: 'soft' as const, driverId };
      });
    }

    return { deleted: true as const, mode: 'soft' as const, driverId };
  }

  async getDriverHistory(context: DriverActorContext, driverId: string): Promise<DriverHistory> {
    const driver = await findDriverOrThrow(context.tenantId, driverId);

    const [auditLog, assignedVehicles] = await Promise.all([
      prisma.auditLog.findMany({
        where: { tenantId: context.tenantId, entity: DRIVER_ENTITY, entityId: driverId },
        orderBy: { createdAt: 'desc' },
      }),
      driver.userId
        ? prisma.vehicle.findMany({
            where: { tenantId: context.tenantId, currentDriverId: driver.userId },
            select: { id: true, plate: true, brand: true, model: true, year: true, status: true },
          })
        : Promise.resolve([]),
    ]);

    return { driverId, assignedVehicles, auditLog };
  }

  async linkVehicle(
    context: DriverActorContext,
    driverId: string,
    vehicleId: string,
  ): Promise<DriverWithFlags> {
    const driver = await findDriverOrThrow(context.tenantId, driverId);

    if (!driver.isActive) {
      throw new ValidationError('Motorista inativo não pode ser vinculado a um veículo');
    }

    if (!driver.userId) {
      throw new ForbiddenError(
        'Motorista sem conta de usuário não pode ser vinculado como condutor ativo. Crie uma conta de usuário para este motorista primeiro.',
      );
    }

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId: context.tenantId },
      select: { id: true, plate: true, status: true, currentDriverId: true },
    });

    if (!vehicle) throw new NotFoundError('Veículo não encontrado');

    if (vehicle.status === 'DECOMMISSIONED') {
      throw new ValidationError('Veículo baixado não pode receber motorista');
    }

    return prisma.$transaction(async (tx) => {
      await tx.vehicle.update({
        where: { id: vehicleId },
        data: { currentDriverId: driver.userId },
      });

      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'VEHICLE_DRIVER_LINKED',
          entity: 'Vehicle',
          entityId: vehicleId,
          changes: toAuditChanges({
            before: { currentDriverId: vehicle.currentDriverId },
            after: { currentDriverId: driver.userId },
            driverId,
          }),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });

      await createAuditLog(tx, context, {
        action: 'DRIVER_VEHICLE_LINKED',
        entityId: driverId,
        changes: { vehicleId, vehiclePlate: vehicle.plate },
      });

      const updated = await tx.driver.findFirst({
        where: { id: driverId },
        include: driverInclude,
      });

      if (!updated) throw new NotFoundError('Motorista não encontrado após vinculação');
      return toDriverWithFlags(updated);
    });
  }

  async importDrivers(
    context: DriverActorContext,
    file?: Express.Multer.File,
    options: DriverImportQueryInput = { preview: false },
  ): Promise<DriverImportResult<DriverRecord | DriverImportPreviewItem>> {
    const rows = await parseDriverImportFile(file as Express.Multer.File);
    const errors: DriverImportError[] = [];

    type PreparedRow = {
      row: number;
      input: DriverCreateInput;
      normalizedCpf: string;
    };

    const parsedRows: PreparedRow[] = [];

    rows.forEach((row, index) => {
      const parseResult = createDriverSchema.safeParse(row);
      const rowNumber = index + 2;
      const rawCpf = typeof row['cpf'] === 'string' ? row['cpf'].replace(/\D/g, '') : undefined;

      if (!parseResult.success) {
        errors.push({
          row: rowNumber,
          cpf: rawCpf,
          errors: flattenValidationIssues(parseResult.error),
        });
        return;
      }

      parsedRows.push({
        row: rowNumber,
        input: parseResult.data,
        normalizedCpf: normalizeCpf(parseResult.data.cpf),
      });
    });

    // Detecta CPFs duplicados dentro do arquivo
    const duplicateRows = new Set<number>();
    const rowsByCpf = new Map<string, PreparedRow[]>();

    for (const row of parsedRows) {
      const items = rowsByCpf.get(row.normalizedCpf) ?? [];
      items.push(row);
      rowsByCpf.set(row.normalizedCpf, items);
    }

    for (const [cpf, items] of rowsByCpf.entries()) {
      if (items.length <= 1) continue;
      items.forEach((item) => {
        duplicateRows.add(item.row);
        errors.push({ row: item.row, cpf, errors: ['CPF duplicado no arquivo de importação'] });
      });
    }

    const uniqueRows = parsedRows.filter((item) => !duplicateRows.has(item.row));

    // Verifica CPFs já cadastrados no tenant
    const existingDrivers =
      uniqueRows.length > 0
        ? await prisma.driver.findMany({
            where: {
              tenantId: context.tenantId,
              cpf: { in: uniqueRows.map((r) => r.normalizedCpf) },
            },
            select: { cpf: true },
          })
        : [];

    const existingCpfSet = new Set(existingDrivers.map((d) => d.cpf));
    const rowsReadyForImport: PreparedRow[] = [];

    for (const row of uniqueRows) {
      if (existingCpfSet.has(row.normalizedCpf)) {
        errors.push({
          row: row.row,
          cpf: row.normalizedCpf,
          errors: ['CPF já cadastrado neste tenant'],
        });
        continue;
      }
      rowsReadyForImport.push(row);
    }

    if (options.preview) {
      return {
        preview: true,
        readyCount: rowsReadyForImport.length,
        importedCount: 0,
        errorCount: errors.length,
        items: rowsReadyForImport.map((row) => ({
          row: row.row,
          name: row.input.name.trim(),
          cpf: row.normalizedCpf,
          phone: row.input.phone,
          department: row.input.department,
          cnhCategory: row.input.cnhCategory,
          cnhExpiration: row.input.cnhExpiration,
        })),
        errors: errors.sort((a, b) => a.row - b.row),
      };
    }

    const items =
      rowsReadyForImport.length === 0
        ? []
        : await prisma.$transaction(async (tx) => {
            const created: DriverRecord[] = [];

            for (const row of rowsReadyForImport) {
              const driver = await tx.driver.create({
                data: buildDriverCreateData(context.tenantId, row.input),
                include: driverInclude,
              });

              await createAuditLog(tx, context, {
                action: 'DRIVER_IMPORTED',
                entityId: driver.id,
                changes: { source: 'import', row: row.row, after: driver },
              });

              created.push(driver);
            }

            return created;
          });

    return {
      importedCount: items.length,
      errorCount: errors.length,
      items,
      errors: errors.sort((a, b) => a.row - b.row),
    };
  }
}

export const driversService = new DriversService();
