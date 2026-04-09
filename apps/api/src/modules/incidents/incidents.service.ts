import { Prisma } from '@frota-leve/database';
import type {
  IncidentStatus as DatabaseIncidentStatus,
  IncidentType as DatabaseIncidentType,
} from '@frota-leve/database';
import type { IncidentType } from '@frota-leve/shared';
import { IncidentStatus } from '@frota-leve/shared';
import { prisma } from '../../config/database';
import { NotFoundError, ValidationError } from '../../shared/errors';
import type {
  IncidentActorContext,
  IncidentDeletionResult,
  IncidentListResponse,
  IncidentStatsResponse,
  IncidentWithRelations,
} from './incidents.types';
import type {
  CreateIncidentInput,
  IncidentStatsQueryInput,
  ListIncidentsQueryInput,
  UpdateIncidentInput,
} from './incidents.validators';

const INCIDENT_ENTITY = 'Incident';

const incidentInclude = {
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
} satisfies Prisma.IncidentInclude;

type IncidentRecord = Prisma.IncidentGetPayload<{ include: typeof incidentInclude }>;

const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  [IncidentStatus.REGISTERED]: [
    IncidentStatus.UNDER_ANALYSIS,
    IncidentStatus.IN_REPAIR,
    IncidentStatus.CONCLUDED,
  ],
  [IncidentStatus.UNDER_ANALYSIS]: [IncidentStatus.IN_REPAIR, IncidentStatus.CONCLUDED],
  [IncidentStatus.IN_REPAIR]: [IncidentStatus.CONCLUDED],
  [IncidentStatus.CONCLUDED]: [],
};

function toDatabaseIncidentStatus(value: IncidentStatus): DatabaseIncidentStatus {
  return value as unknown as DatabaseIncidentStatus;
}

function toDatabaseIncidentType(value: IncidentType): DatabaseIncidentType {
  return value as unknown as DatabaseIncidentType;
}

function toAuditChanges(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value == null) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeOptionalString(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalArray(
  value?: string[] | null,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (!value || value.length === 0) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function normalizeStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function assertValidTransition(current: IncidentStatus, next: IncidentStatus): void {
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

export class IncidentsService {
  async listIncidents(
    context: IncidentActorContext,
    query: ListIncidentsQueryInput,
  ): Promise<IncidentListResponse<IncidentWithRelations>> {
    const { tenantId } = context;
    const {
      vehicleId,
      driverId,
      status,
      type,
      search,
      dateFrom,
      dateTo,
      page,
      pageSize,
      sortBy,
      sortOrder,
    } = query;

    const where: Prisma.IncidentWhereInput = {
      tenantId,
      ...(vehicleId ? { vehicleId } : {}),
      ...(driverId ? { driverId } : {}),
      ...(status ? { status: toDatabaseIncidentStatus(status) } : {}),
      ...(type ? { type: toDatabaseIncidentType(type) } : {}),
      ...(search
        ? {
            OR: [
              { location: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { insuranceClaimNumber: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(dateFrom || dateTo
        ? { date: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.incident.findMany({
        where,
        include: incidentInclude,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.incident.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      items: items.map((item) => this.toIncidentResponse(item)),
      hasNext: page < totalPages,
      meta: { page, pageSize, total, totalPages },
    };
  }

  async getIncidentById(
    context: IncidentActorContext,
    incidentId: string,
  ): Promise<IncidentWithRelations> {
    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, tenantId: context.tenantId },
      include: incidentInclude,
    });

    if (!incident) throw new NotFoundError('Sinistro não encontrado');

    return this.toIncidentResponse(incident);
  }

  async createIncident(
    context: IncidentActorContext,
    input: CreateIncidentInput,
  ): Promise<IncidentWithRelations> {
    const { tenantId, userId, ipAddress, userAgent } = context;

    await ensureVehicleBelongsToTenant(tenantId, input.vehicleId);
    await ensureDriverBelongsToTenant(tenantId, input.driverId ?? null);

    const created = await prisma.$transaction(async (tx) => {
      const incident = await tx.incident.create({
        data: {
          tenantId,
          vehicleId: input.vehicleId,
          driverId: input.driverId ?? null,
          date: input.date,
          location: input.location.trim(),
          type: toDatabaseIncidentType(input.type),
          description: input.description.trim(),
          thirdPartyInvolved: input.thirdPartyInvolved,
          policeReport: input.policeReport,
          insurerNotified: input.insurerNotified,
          insuranceClaimNumber: normalizeOptionalString(input.insuranceClaimNumber),
          estimatedCost: input.estimatedCost ?? null,
          actualCost: input.actualCost ?? null,
          status: toDatabaseIncidentStatus(IncidentStatus.REGISTERED),
          photos: normalizeOptionalArray(input.photos),
          documents: normalizeOptionalArray(input.documents),
          downtime: input.downtime ?? null,
          notes: normalizeOptionalString(input.notes),
        },
        include: incidentInclude,
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'INCIDENT_CREATED',
          entity: INCIDENT_ENTITY,
          entityId: incident.id,
          changes: toAuditChanges({
            vehicleId: input.vehicleId,
            driverId: input.driverId ?? null,
            type: input.type,
            status: IncidentStatus.REGISTERED,
            estimatedCost: input.estimatedCost ?? null,
            actualCost: input.actualCost ?? null,
          }),
          ipAddress,
          userAgent,
        },
      });

      return incident;
    });

    return this.toIncidentResponse(created);
  }

  async updateIncident(
    context: IncidentActorContext,
    incidentId: string,
    input: UpdateIncidentInput,
  ): Promise<IncidentWithRelations> {
    const { tenantId, userId, ipAddress, userAgent } = context;

    const current = await prisma.incident.findFirst({
      where: { id: incidentId, tenantId },
      include: incidentInclude,
    });

    if (!current) throw new NotFoundError('Sinistro não encontrado');

    await ensureVehicleBelongsToTenant(tenantId, input.vehicleId);
    await ensureDriverBelongsToTenant(tenantId, input.driverId ?? null);

    const currentStatus = current.status as unknown as IncidentStatus;
    const nextStatus = input.status;

    assertValidTransition(currentStatus, nextStatus);

    const updated = await prisma.$transaction(async (tx) => {
      const incident = await tx.incident.update({
        where: { id: incidentId },
        data: {
          vehicleId: input.vehicleId,
          driverId: input.driverId ?? null,
          date: input.date,
          location: input.location.trim(),
          type: toDatabaseIncidentType(input.type),
          description: input.description.trim(),
          thirdPartyInvolved: input.thirdPartyInvolved,
          policeReport: input.policeReport,
          insurerNotified: input.insurerNotified,
          insuranceClaimNumber: normalizeOptionalString(input.insuranceClaimNumber),
          estimatedCost: input.estimatedCost ?? null,
          actualCost: input.actualCost ?? null,
          status: toDatabaseIncidentStatus(nextStatus),
          photos: normalizeOptionalArray(input.photos),
          documents: normalizeOptionalArray(input.documents),
          downtime: input.downtime ?? null,
          notes: normalizeOptionalString(input.notes),
        },
        include: incidentInclude,
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'INCIDENT_UPDATED',
          entity: INCIDENT_ENTITY,
          entityId: incidentId,
          changes: toAuditChanges({
            before: {
              status: currentStatus,
              driverId: current.driverId,
              estimatedCost: current.estimatedCost,
              actualCost: current.actualCost,
            },
            after: {
              status: nextStatus,
              driverId: input.driverId ?? null,
              estimatedCost: input.estimatedCost ?? null,
              actualCost: input.actualCost ?? null,
            },
          }),
          ipAddress,
          userAgent,
        },
      });

      return incident;
    });

    return this.toIncidentResponse(updated);
  }

  async deleteIncident(
    context: IncidentActorContext,
    incidentId: string,
  ): Promise<IncidentDeletionResult> {
    const { tenantId, userId, ipAddress, userAgent } = context;

    const incident = await prisma.incident.findFirst({
      where: { id: incidentId, tenantId },
    });

    if (!incident) throw new NotFoundError('Sinistro não encontrado');

    const currentStatus = incident.status as unknown as IncidentStatus;

    if (currentStatus !== IncidentStatus.REGISTERED) {
      throw new ValidationError('Apenas sinistros registrados podem ser excluídos');
    }

    const auditCount = await prisma.auditLog.count({
      where: { tenantId, entity: INCIDENT_ENTITY, entityId: incidentId },
    });

    if (auditCount <= 1) {
      await prisma.$transaction(async (tx) => {
        await tx.auditLog.deleteMany({
          where: { tenantId, entity: INCIDENT_ENTITY, entityId: incidentId },
        });
        await tx.incident.delete({ where: { id: incidentId } });
      });

      return { deleted: true, mode: 'hard', incidentId };
    }

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'INCIDENT_DELETED',
          entity: INCIDENT_ENTITY,
          entityId: incidentId,
          changes: toAuditChanges({
            type: incident.type,
            location: incident.location,
            actualCost: incident.actualCost,
          }),
          ipAddress,
          userAgent,
        },
      });

      await tx.incident.delete({ where: { id: incidentId } });
    });

    return { deleted: true, mode: 'soft', incidentId };
  }

  async getStats(
    context: IncidentActorContext,
    query: IncidentStatsQueryInput,
  ): Promise<IncidentStatsResponse> {
    const { tenantId } = context;
    const { vehicleId, driverId, status, type, dateFrom, dateTo, granularity } = query;

    const where: Prisma.IncidentWhereInput = {
      tenantId,
      ...(vehicleId ? { vehicleId } : {}),
      ...(driverId ? { driverId } : {}),
      ...(status ? { status: toDatabaseIncidentStatus(status) } : {}),
      ...(type ? { type: toDatabaseIncidentType(type) } : {}),
      ...(dateFrom || dateTo
        ? { date: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
        : {}),
    };

    const incidents = await prisma.incident.findMany({
      where,
      select: {
        date: true,
        type: true,
        status: true,
        estimatedCost: true,
        actualCost: true,
        downtime: true,
      },
    });

    if (incidents.length === 0) {
      return {
        summary: {
          total: 0,
          totalEstimatedCost: 0,
          totalActualCost: 0,
          averageEstimatedCost: 0,
          averageActualCost: 0,
          totalDowntime: 0,
          averageDowntime: 0,
          dateFrom: dateFrom ?? null,
          dateTo: dateTo ?? null,
        },
        byStatus: [],
        byType: [],
        byPeriod: [],
      };
    }

    const totalEstimatedCost = incidents.reduce((sum, item) => sum + (item.estimatedCost ?? 0), 0);
    const totalActualCost = incidents.reduce((sum, item) => sum + (item.actualCost ?? 0), 0);
    const totalDowntime = incidents.reduce((sum, item) => sum + (item.downtime ?? 0), 0);
    const estimatedCount = incidents.filter((item) => item.estimatedCost != null).length;
    const actualCount = incidents.filter((item) => item.actualCost != null).length;
    const downtimeCount = incidents.filter((item) => item.downtime != null).length;

    const statusMap = new Map<
      string,
      { count: number; estimatedCost: number; actualCost: number; downtime: number }
    >();
    for (const item of incidents) {
      const key = String(item.status);
      const entry = statusMap.get(key) ?? {
        count: 0,
        estimatedCost: 0,
        actualCost: 0,
        downtime: 0,
      };
      entry.count++;
      entry.estimatedCost += item.estimatedCost ?? 0;
      entry.actualCost += item.actualCost ?? 0;
      entry.downtime += item.downtime ?? 0;
      statusMap.set(key, entry);
    }

    const typeMap = new Map<
      string,
      { count: number; estimatedCost: number; actualCost: number; downtime: number }
    >();
    for (const item of incidents) {
      const key = String(item.type);
      const entry = typeMap.get(key) ?? {
        count: 0,
        estimatedCost: 0,
        actualCost: 0,
        downtime: 0,
      };
      entry.count++;
      entry.estimatedCost += item.estimatedCost ?? 0;
      entry.actualCost += item.actualCost ?? 0;
      entry.downtime += item.downtime ?? 0;
      typeMap.set(key, entry);
    }

    const periodMap = new Map<string, { count: number; actualCost: number; downtime: number }>();
    for (const item of incidents) {
      const d = item.date;
      const period =
        granularity === 'day'
          ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
          : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

      const entry = periodMap.get(period) ?? { count: 0, actualCost: 0, downtime: 0 };
      entry.count++;
      entry.actualCost += item.actualCost ?? 0;
      entry.downtime += item.downtime ?? 0;
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
        total: incidents.length,
        totalEstimatedCost,
        totalActualCost,
        averageEstimatedCost: estimatedCount > 0 ? totalEstimatedCost / estimatedCount : 0,
        averageActualCost: actualCount > 0 ? totalActualCost / actualCount : 0,
        totalDowntime,
        averageDowntime: downtimeCount > 0 ? totalDowntime / downtimeCount : 0,
        dateFrom: dateFrom ?? null,
        dateTo: dateTo ?? null,
      },
      byStatus: [...statusMap.entries()].map(([statusKey, data]) => ({
        status: statusKey,
        ...data,
      })),
      byType: [...typeMap.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([typeKey, data]) => ({ type: typeKey, ...data })),
      byPeriod,
    };
  }

  private toIncidentResponse(record: IncidentRecord): IncidentWithRelations {
    return {
      id: record.id,
      tenantId: record.tenantId,
      vehicleId: record.vehicleId,
      driverId: record.driverId,
      date: record.date,
      location: record.location,
      type: record.type,
      description: record.description,
      thirdPartyInvolved: record.thirdPartyInvolved,
      policeReport: record.policeReport,
      insurerNotified: record.insurerNotified,
      insuranceClaimNumber: record.insuranceClaimNumber,
      estimatedCost: record.estimatedCost,
      actualCost: record.actualCost,
      status: record.status,
      photos: normalizeStringArray(record.photos),
      documents: normalizeStringArray(record.documents),
      downtime: record.downtime,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      vehicle: record.vehicle,
      driver: record.driver,
    };
  }
}

export const incidentsService = new IncidentsService();
