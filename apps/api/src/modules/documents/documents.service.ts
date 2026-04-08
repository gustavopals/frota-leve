import { Prisma } from '@frota-leve/database';
import { prisma } from '../../config/database';
import { NotFoundError } from '../../shared/errors';
import {
  DOCUMENT_ENTITY,
  getDaysUntilExpiration,
  refreshDocumentStatuses,
  resolveDocumentStatus,
} from './documents.alerts';
import type {
  DocumentActorContext,
  DocumentDeletionResult,
  DocumentListResponse,
  DocumentWithRelations,
  PendingDocumentBucketKey,
  PendingDocumentItem,
  PendingDocumentsResponse,
} from './documents.types';
import type {
  DocumentCreateInput,
  DocumentListQueryInput,
  PendingDocumentsQueryInput,
  DocumentReplaceInput,
} from './documents.validators';

const documentInclude = {
  vehicle: {
    select: { id: true, plate: true, brand: true, model: true, year: true },
  },
  driver: {
    select: { id: true, name: true, cpf: true, cnhNumber: true },
  },
} satisfies Prisma.DocumentInclude;

type DocumentRecord = Prisma.DocumentGetPayload<{
  include: typeof documentInclude;
}>;

type TransactionClient = Prisma.TransactionClient;

const PENDING_WINDOW_30_DAYS = 30;
const PENDING_WINDOW_60_DAYS = 60;
const PENDING_WINDOW_90_DAYS = 90;

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number): Date {
  const result = startOfDay(value);
  result.setDate(result.getDate() + days);
  return result;
}

function resolvePendingBucket(daysUntilExpiration: number): PendingDocumentBucketKey | null {
  if (daysUntilExpiration < 0 || daysUntilExpiration > PENDING_WINDOW_90_DAYS) {
    return null;
  }

  if (daysUntilExpiration <= PENDING_WINDOW_30_DAYS) {
    return 'upTo30Days';
  }

  if (daysUntilExpiration <= PENDING_WINDOW_60_DAYS) {
    return 'days31To60';
  }

  return 'days61To90';
}

function normalizeOptionalString(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function toAuditChanges(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value == null) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function buildDocumentPayload(input: DocumentCreateInput | DocumentReplaceInput) {
  return {
    vehicleId: input.vehicleId ?? null,
    driverId: input.driverId ?? null,
    type: input.type,
    description: input.description.trim(),
    expirationDate: input.expirationDate,
    alertDaysBefore: input.alertDaysBefore,
    cost: input.cost ?? null,
    fileUrl: input.fileUrl.trim(),
    status: resolveDocumentStatus(input.expirationDate, input.alertDaysBefore),
    notes: normalizeOptionalString(input.notes),
  };
}

async function createAuditLog(
  tx: TransactionClient,
  context: DocumentActorContext,
  params: { action: string; entityId: string; changes: unknown },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      tenantId: context.tenantId,
      userId: context.userId,
      action: params.action,
      entity: DOCUMENT_ENTITY,
      entityId: params.entityId,
      changes: toAuditChanges(params.changes),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    },
  });
}

async function ensureVehicleExists(tenantId: string, vehicleId: string): Promise<void> {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, tenantId },
    select: { id: true },
  });

  if (!vehicle) {
    throw new NotFoundError('Veículo não encontrado');
  }
}

async function ensureDriverExists(tenantId: string, driverId: string): Promise<void> {
  const driver = await prisma.driver.findFirst({
    where: { id: driverId, tenantId },
    select: { id: true },
  });

  if (!driver) {
    throw new NotFoundError('Motorista não encontrado');
  }
}

export class DocumentsService {
  async listDocuments(
    context: DocumentActorContext,
    query: DocumentListQueryInput,
  ): Promise<DocumentListResponse<DocumentWithRelations>> {
    await refreshDocumentStatuses(prisma, context.tenantId);

    const where: Prisma.DocumentWhereInput = {
      tenantId: context.tenantId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
      ...(query.driverId ? { driverId: query.driverId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.document.findMany({
        where,
        include: documentInclude,
        orderBy: { [query.sortBy]: query.sortOrder } as Prisma.DocumentOrderByWithRelationInput,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.document.count({ where }),
    ]);

    const totalPages = Math.max(Math.ceil(total / query.pageSize), 1);

    return {
      items: items.map((item) => this.toDocumentResponse(item)),
      hasNext: query.page < totalPages,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages,
      },
    };
  }

  async getDocumentById(
    context: DocumentActorContext,
    documentId: string,
  ): Promise<DocumentWithRelations> {
    await refreshDocumentStatuses(prisma, context.tenantId, documentId);

    const document = await prisma.document.findFirst({
      where: { id: documentId, tenantId: context.tenantId },
      include: documentInclude,
    });

    if (!document) {
      throw new NotFoundError('Documento não encontrado');
    }

    return this.toDocumentResponse(document);
  }

  async getPendingDocuments(
    context: DocumentActorContext,
    query: PendingDocumentsQueryInput,
  ): Promise<PendingDocumentsResponse> {
    await refreshDocumentStatuses(prisma, context.tenantId);

    const today = startOfDay(new Date());
    const limitDate = addDays(today, PENDING_WINDOW_90_DAYS);

    const where: Prisma.DocumentWhereInput = {
      tenantId: context.tenantId,
      expirationDate: {
        gte: today,
        lte: limitDate,
      },
      ...(query.type ? { type: query.type } : {}),
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
      ...(query.driverId ? { driverId: query.driverId } : {}),
    };

    const documents = await prisma.document.findMany({
      where,
      include: documentInclude,
      orderBy: { expirationDate: 'asc' },
    });

    const buckets: PendingDocumentsResponse['buckets'] = {
      upTo30Days: [],
      days31To60: [],
      days61To90: [],
    };

    for (const document of documents) {
      const mapped = this.toDocumentResponse(document);
      const bucket = resolvePendingBucket(mapped.daysUntilExpiration);

      if (!bucket) {
        continue;
      }

      const pendingItem: PendingDocumentItem = {
        ...mapped,
        bucket,
      };

      buckets[bucket].push(pendingItem);
    }

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        upTo30Days: buckets.upTo30Days.length,
        upTo60Days: buckets.upTo30Days.length + buckets.days31To60.length,
        upTo90Days:
          buckets.upTo30Days.length + buckets.days31To60.length + buckets.days61To90.length,
        total: buckets.upTo30Days.length + buckets.days31To60.length + buckets.days61To90.length,
      },
      buckets,
    };
  }

  async createDocument(
    context: DocumentActorContext,
    input: DocumentCreateInput,
  ): Promise<DocumentWithRelations> {
    if (input.vehicleId) {
      await ensureVehicleExists(context.tenantId, input.vehicleId);
    }

    if (input.driverId) {
      await ensureDriverExists(context.tenantId, input.driverId);
    }

    const payload = buildDocumentPayload(input);

    const created = await prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          tenantId: context.tenantId,
          ...payload,
        },
        include: documentInclude,
      });

      await createAuditLog(tx, context, {
        action: 'DOCUMENT_CREATED',
        entityId: document.id,
        changes: {
          after: {
            vehicleId: document.vehicleId,
            driverId: document.driverId,
            type: document.type,
            expirationDate: document.expirationDate,
            alertDaysBefore: document.alertDaysBefore,
            status: document.status,
          },
        },
      });

      return document;
    });

    return this.toDocumentResponse(created);
  }

  async replaceDocument(
    context: DocumentActorContext,
    documentId: string,
    input: DocumentReplaceInput,
  ): Promise<DocumentWithRelations> {
    const existing = await prisma.document.findFirst({
      where: { id: documentId, tenantId: context.tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Documento não encontrado');
    }

    if (input.vehicleId) {
      await ensureVehicleExists(context.tenantId, input.vehicleId);
    }

    if (input.driverId) {
      await ensureDriverExists(context.tenantId, input.driverId);
    }

    const payload = buildDocumentPayload(input);

    const updated = await prisma.$transaction(async (tx) => {
      const document = await tx.document.update({
        where: { id: documentId },
        data: payload,
        include: documentInclude,
      });

      await createAuditLog(tx, context, {
        action: 'DOCUMENT_UPDATED',
        entityId: document.id,
        changes: {
          before: {
            vehicleId: existing.vehicleId,
            driverId: existing.driverId,
            type: existing.type,
            expirationDate: existing.expirationDate,
            alertDaysBefore: existing.alertDaysBefore,
            status: existing.status,
          },
          after: {
            vehicleId: document.vehicleId,
            driverId: document.driverId,
            type: document.type,
            expirationDate: document.expirationDate,
            alertDaysBefore: document.alertDaysBefore,
            status: document.status,
          },
        },
      });

      return document;
    });

    return this.toDocumentResponse(updated);
  }

  async deleteDocument(
    context: DocumentActorContext,
    documentId: string,
  ): Promise<DocumentDeletionResult> {
    const existing = await prisma.document.findFirst({
      where: { id: documentId, tenantId: context.tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Documento não encontrado');
    }

    await prisma.$transaction(async (tx) => {
      await tx.document.delete({ where: { id: documentId } });

      await createAuditLog(tx, context, {
        action: 'DOCUMENT_DELETED',
        entityId: documentId,
        changes: {
          vehicleId: existing.vehicleId,
          driverId: existing.driverId,
          type: existing.type,
          expirationDate: existing.expirationDate,
          status: existing.status,
        },
      });
    });

    return {
      deleted: true,
      documentId,
    };
  }

  private toDocumentResponse(document: DocumentRecord): DocumentWithRelations {
    return {
      id: document.id,
      tenantId: document.tenantId,
      vehicleId: document.vehicleId,
      driverId: document.driverId,
      type: document.type,
      description: document.description,
      expirationDate: document.expirationDate,
      alertDaysBefore: document.alertDaysBefore,
      cost: document.cost,
      fileUrl: document.fileUrl,
      status: resolveDocumentStatus(document.expirationDate, document.alertDaysBefore),
      notes: document.notes,
      createdAt: document.createdAt,
      daysUntilExpiration: getDaysUntilExpiration(document.expirationDate),
      vehicle: document.vehicle
        ? {
            id: document.vehicle.id,
            plate: document.vehicle.plate,
            brand: document.vehicle.brand,
            model: document.vehicle.model,
            year: document.vehicle.year,
          }
        : null,
      driver: document.driver
        ? {
            id: document.driver.id,
            name: document.driver.name,
            cpf: document.driver.cpf,
            cnhNumber: document.driver.cnhNumber ?? null,
          }
        : null,
    };
  }
}

export const documentsService = new DocumentsService();
