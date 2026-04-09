import { MaintenanceType, Prisma, ServiceOrderStatus } from '@frota-leve/database';
import { ChecklistExecutionStatus, ChecklistItemStatus } from '@frota-leve/shared';
import { prisma } from '../../config/database';
import { NotFoundError, ValidationError } from '../../shared/errors';
import type {
  ChecklistActorContext,
  ChecklistComplianceResponse,
  ChecklistExecutionListResponse,
  ChecklistExecutionResponse,
  ChecklistTemplateDeletionResult,
  ChecklistTemplateListResponse,
  ChecklistTemplateResponse,
} from './checklists.types';
import type {
  ChecklistComplianceQueryInput,
  CreateChecklistExecutionInput,
  CreateChecklistTemplateInput,
  ListChecklistExecutionsQueryInput,
  ListChecklistTemplatesQueryInput,
  ReplaceChecklistTemplateInput,
} from './checklists.validators';

const CHECKLIST_TEMPLATE_ENTITY = 'ChecklistTemplate';
const CHECKLIST_EXECUTION_ENTITY = 'ChecklistExecution';

const checklistTemplateInclude = {
  items: {
    orderBy: {
      displayOrder: 'asc',
    },
  },
} satisfies Prisma.ChecklistTemplateInclude;

type ChecklistTemplateRecord = Prisma.ChecklistTemplateGetPayload<{
  include: typeof checklistTemplateInclude;
}>;

const checklistExecutionInclude = {
  template: {
    select: {
      id: true,
      name: true,
      vehicleCategory: true,
    },
  },
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
  items: {
    orderBy: {
      createdAt: 'asc',
    },
  },
} satisfies Prisma.ChecklistExecutionInclude;

type ChecklistExecutionRecord = Prisma.ChecklistExecutionGetPayload<{
  include: typeof checklistExecutionInclude;
}>;

type NonCompliantChecklistItemInput = CreateChecklistExecutionInput['items'][number] & {
  status: ChecklistItemStatus.NON_COMPLIANT;
};

function toAuditChanges(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value == null) return Prisma.JsonNull;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function mapTemplateItems(
  items: Array<{ label: string; required: boolean; photoRequired: boolean }>,
): Prisma.ChecklistItemCreateWithoutTemplateInput[] {
  return items.map((item, index) => ({
    label: item.label.trim(),
    required: item.required,
    photoRequired: item.photoRequired,
    displayOrder: index,
  }));
}

function normalizeOptionalString(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function roundToTwoDecimals(value: number): number {
  return Number(value.toFixed(2));
}

function resolveExecutionStatus(
  items: Array<{ status: ChecklistItemStatus }>,
): ChecklistExecutionStatus {
  if (items.some((item) => item.status === ChecklistItemStatus.NON_COMPLIANT)) {
    return ChecklistExecutionStatus.NON_COMPLIANT;
  }

  if (items.some((item) => item.status === ChecklistItemStatus.ATTENTION)) {
    return ChecklistExecutionStatus.ATTENTION;
  }

  return ChecklistExecutionStatus.COMPLIANT;
}

function getNonCompliantItems(
  items: CreateChecklistExecutionInput['items'],
): NonCompliantChecklistItemInput[] {
  return items.filter(
    (item): item is NonCompliantChecklistItemInput =>
      item.status === ChecklistItemStatus.NON_COMPLIANT,
  );
}

function getTemplateItemOrThrow(
  templateItemsById: Map<string, ChecklistTemplateRecord['items'][number]>,
  checklistItemId: string,
): ChecklistTemplateRecord['items'][number] {
  const templateItem = templateItemsById.get(checklistItemId);

  if (!templateItem) {
    throw new ValidationError('A execução contém item que não pertence ao template informado');
  }

  return templateItem;
}

function buildCorrectiveServiceOrderNotes(params: {
  templateName: string;
  executedAt: Date;
  location: string | null;
  checklistNotes: string | null;
  nonCompliantItems: Array<{ label: string; notes: string | null }>;
}): string {
  const lines = [
    `OS gerada automaticamente pela execução do checklist "${params.templateName}".`,
    `Data da execução: ${params.executedAt.toISOString()}.`,
  ];

  if (params.location) {
    lines.push(`Local: ${params.location}.`);
  }

  if (params.checklistNotes) {
    lines.push(`Observações do checklist: ${params.checklistNotes}`);
  }

  if (params.nonCompliantItems.length > 0) {
    lines.push(
      `Itens não conformes: ${params.nonCompliantItems
        .map((item) => (item.notes ? `${item.label} (${item.notes})` : item.label))
        .join('; ')}`,
    );
  }

  return lines.join('\n');
}

export class ChecklistsService {
  async executeChecklist(
    context: ChecklistActorContext,
    input: CreateChecklistExecutionInput,
  ): Promise<ChecklistExecutionResponse> {
    const [template, vehicle, driver] = await Promise.all([
      prisma.checklistTemplate.findFirst({
        where: { id: input.templateId, tenantId: context.tenantId },
        include: checklistTemplateInclude,
      }),
      prisma.vehicle.findFirst({
        where: { id: input.vehicleId, tenantId: context.tenantId },
        select: {
          id: true,
          plate: true,
          brand: true,
          model: true,
          year: true,
        },
      }),
      prisma.driver.findFirst({
        where: { id: input.driverId, tenantId: context.tenantId },
        select: {
          id: true,
          name: true,
          cpf: true,
        },
      }),
    ]);

    if (!template) {
      throw new NotFoundError('Template de checklist não encontrado');
    }

    if (!vehicle) {
      throw new NotFoundError('Veículo não encontrado');
    }

    if (!driver) {
      throw new NotFoundError('Motorista não encontrado');
    }

    if (template.items.length !== input.items.length) {
      throw new ValidationError(
        'Todos os itens do template devem ser respondidos exatamente uma vez',
      );
    }

    const templateItemsById = new Map(template.items.map((item) => [item.id, item]));
    const seenItemIds = new Set<string>();

    for (const item of input.items) {
      if (seenItemIds.has(item.checklistItemId)) {
        throw new ValidationError('Há itens duplicados na execução do checklist');
      }

      const templateItem = templateItemsById.get(item.checklistItemId);

      if (!templateItem) {
        throw new ValidationError('A execução contém item que não pertence ao template informado');
      }

      if (templateItem.photoRequired && !item.photoUrl) {
        throw new ValidationError(`O item "${templateItem.label}" exige foto`);
      }

      seenItemIds.add(item.checklistItemId);
    }

    for (const templateItem of template.items) {
      if (templateItem.required && !seenItemIds.has(templateItem.id)) {
        throw new ValidationError(`O item obrigatório "${templateItem.label}" não foi informado`);
      }
    }

    const executionStatus = resolveExecutionStatus(input.items);
    const nonCompliantItems = getNonCompliantItems(input.items);

    const created = await prisma.$transaction(async (tx) => {
      const execution = await tx.checklistExecution.create({
        data: {
          tenantId: context.tenantId,
          templateId: input.templateId,
          vehicleId: input.vehicleId,
          driverId: input.driverId,
          executedAt: input.executedAt,
          status: executionStatus,
          signatureUrl: normalizeOptionalString(input.signatureUrl),
          location: normalizeOptionalString(input.location),
          notes: normalizeOptionalString(input.notes),
          createdByUserId: context.userId,
          items: {
            create: input.items.map((item: CreateChecklistExecutionInput['items'][number]) => {
              const templateItem = getTemplateItemOrThrow(templateItemsById, item.checklistItemId);

              return {
                checklistItemId: item.checklistItemId,
                label: templateItem.label,
                status: item.status,
                photoUrl: normalizeOptionalString(item.photoUrl),
                notes: normalizeOptionalString(item.notes),
              };
            }),
          },
        },
        include: checklistExecutionInclude,
      });

      let correctiveServiceOrderId: string | null = null;

      if (nonCompliantItems.length > 0) {
        const photoUrls = nonCompliantItems
          .map((item) => normalizeOptionalString(item.photoUrl))
          .filter((value): value is string => value !== null);

        const serviceOrder = await tx.serviceOrder.create({
          data: {
            tenantId: context.tenantId,
            vehicleId: input.vehicleId,
            driverId: input.driverId,
            planId: null,
            type: MaintenanceType.CORRECTIVE,
            status: ServiceOrderStatus.OPEN,
            description: `OS corretiva automática - checklist ${template.name}`,
            workshop: null,
            startDate: null,
            endDate: null,
            totalCost: 0,
            laborCost: 0,
            partsCost: 0,
            notes: buildCorrectiveServiceOrderNotes({
              templateName: template.name,
              executedAt: input.executedAt,
              location: normalizeOptionalString(input.location),
              checklistNotes: normalizeOptionalString(input.notes),
              nonCompliantItems: nonCompliantItems.map((item) => ({
                label: getTemplateItemOrThrow(templateItemsById, item.checklistItemId).label,
                notes: normalizeOptionalString(item.notes),
              })),
            }),
            ...(photoUrls.length > 0 ? { photos: photoUrls as Prisma.InputJsonValue } : {}),
            invoiceUrl: null,
            approvedByUserId: null,
            createdByUserId: context.userId,
            items: {
              create: nonCompliantItems.map((item) => ({
                description: getTemplateItemOrThrow(templateItemsById, item.checklistItemId).label,
                quantity: 1,
                unitCost: 0,
                totalCost: 0,
                partNumber: null,
              })),
            },
          },
          select: {
            id: true,
          },
        });

        correctiveServiceOrderId = serviceOrder.id;

        await tx.auditLog.create({
          data: {
            tenantId: context.tenantId,
            userId: context.userId,
            action: 'SERVICE_ORDER_CREATED',
            entity: 'ServiceOrder',
            entityId: serviceOrder.id,
            changes: toAuditChanges({
              vehicleId: input.vehicleId,
              driverId: input.driverId,
              planId: null,
              type: MaintenanceType.CORRECTIVE,
              status: ServiceOrderStatus.OPEN,
              totalCost: 0,
              itemCount: nonCompliantItems.length,
              source: 'CHECKLIST_NON_COMPLIANT',
              checklistExecutionId: execution.id,
            }),
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'CHECKLIST_EXECUTION_CREATED',
          entity: CHECKLIST_EXECUTION_ENTITY,
          entityId: execution.id,
          changes: toAuditChanges({
            templateId: execution.templateId,
            vehicleId: execution.vehicleId,
            driverId: execution.driverId,
            status: execution.status,
            itemCount: execution.items.length,
            correctiveServiceOrderId,
          }),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });

      return {
        execution,
        correctiveServiceOrderId,
      };
    });

    return this.toExecutionResponse(created.execution, created.correctiveServiceOrderId);
  }

  async listTemplates(
    context: ChecklistActorContext,
    query: ListChecklistTemplatesQueryInput,
  ): Promise<ChecklistTemplateListResponse<ChecklistTemplateResponse>> {
    const where: Prisma.ChecklistTemplateWhereInput = {
      tenantId: context.tenantId,
      ...(query.vehicleCategory ? { vehicleCategory: query.vehicleCategory } : {}),
      ...(query.search ? { name: { contains: query.search.trim(), mode: 'insensitive' } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.checklistTemplate.findMany({
        where,
        include: checklistTemplateInclude,
        orderBy: { [query.sortBy]: query.sortOrder },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.checklistTemplate.count({ where }),
    ]);

    const totalPages = Math.max(Math.ceil(total / query.pageSize), 1);

    return {
      items: items.map((item) => this.toTemplateResponse(item)),
      hasNext: query.page < totalPages,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages,
      },
    };
  }

  async listExecutions(
    context: ChecklistActorContext,
    query: ListChecklistExecutionsQueryInput,
  ): Promise<ChecklistExecutionListResponse> {
    const where: Prisma.ChecklistExecutionWhereInput = {
      tenantId: context.tenantId,
      ...(query.vehicleId ? { vehicleId: query.vehicleId } : {}),
      ...(query.driverId ? { driverId: query.driverId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            executedAt: {
              ...(query.dateFrom ? { gte: query.dateFrom } : {}),
              ...(query.dateTo ? { lte: query.dateTo } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.checklistExecution.findMany({
        where,
        include: checklistExecutionInclude,
        orderBy: [{ executedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.checklistExecution.count({ where }),
    ]);

    const totalPages = Math.max(Math.ceil(total / query.pageSize), 1);

    return {
      items: items.map((item) => this.toExecutionResponse(item)),
      hasNext: query.page < totalPages,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages,
      },
    };
  }

  async getCompliance(
    context: ChecklistActorContext,
    query: ChecklistComplianceQueryInput,
  ): Promise<ChecklistComplianceResponse> {
    const { tenantId } = context;
    const { templateId, vehicleId, driverId, dateFrom, dateTo, granularity } = query;

    const where: Prisma.ChecklistExecutionWhereInput = {
      tenantId,
      ...(templateId ? { templateId } : {}),
      ...(vehicleId ? { vehicleId } : {}),
      ...(driverId ? { driverId } : {}),
      ...(dateFrom || dateTo
        ? {
            executedAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };

    const executions = await prisma.checklistExecution.findMany({
      where,
      select: {
        executedAt: true,
        status: true,
      },
    });

    const allStatuses = [
      ChecklistExecutionStatus.COMPLIANT,
      ChecklistExecutionStatus.ATTENTION,
      ChecklistExecutionStatus.NON_COMPLIANT,
    ] as const;

    if (executions.length === 0) {
      return {
        summary: {
          totalExecutions: 0,
          compliantExecutions: 0,
          attentionExecutions: 0,
          nonCompliantExecutions: 0,
          complianceRate: 0,
          attentionRate: 0,
          nonComplianceRate: 0,
          dateFrom: dateFrom ?? null,
          dateTo: dateTo ?? null,
        },
        byStatus: allStatuses.map((status) => ({
          status,
          count: 0,
          percentage: 0,
        })),
        byPeriod: [],
      };
    }

    const statusMap = new Map<ChecklistExecutionStatus, number>(
      allStatuses.map((status) => [status, 0]),
    );
    const periodMap = new Map<
      string,
      {
        totalExecutions: number;
        compliantExecutions: number;
        attentionExecutions: number;
        nonCompliantExecutions: number;
      }
    >();

    for (const execution of executions) {
      const status = execution.status as ChecklistExecutionStatus;
      statusMap.set(status, (statusMap.get(status) ?? 0) + 1);

      const d = execution.executedAt;
      const period =
        granularity === 'day'
          ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
          : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

      const entry = periodMap.get(period) ?? {
        totalExecutions: 0,
        compliantExecutions: 0,
        attentionExecutions: 0,
        nonCompliantExecutions: 0,
      };

      entry.totalExecutions++;
      if (status === ChecklistExecutionStatus.COMPLIANT) entry.compliantExecutions++;
      if (status === ChecklistExecutionStatus.ATTENTION) entry.attentionExecutions++;
      if (status === ChecklistExecutionStatus.NON_COMPLIANT) entry.nonCompliantExecutions++;

      periodMap.set(period, entry);
    }

    const totalExecutions = executions.length;
    const compliantExecutions = statusMap.get(ChecklistExecutionStatus.COMPLIANT) ?? 0;
    const attentionExecutions = statusMap.get(ChecklistExecutionStatus.ATTENTION) ?? 0;
    const nonCompliantExecutions = statusMap.get(ChecklistExecutionStatus.NON_COMPLIANT) ?? 0;

    const monthLabels = [
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

    return {
      summary: {
        totalExecutions,
        compliantExecutions,
        attentionExecutions,
        nonCompliantExecutions,
        complianceRate: roundToTwoDecimals((compliantExecutions / totalExecutions) * 100),
        attentionRate: roundToTwoDecimals((attentionExecutions / totalExecutions) * 100),
        nonComplianceRate: roundToTwoDecimals((nonCompliantExecutions / totalExecutions) * 100),
        dateFrom: dateFrom ?? null,
        dateTo: dateTo ?? null,
      },
      byStatus: allStatuses.map((status) => {
        const count = statusMap.get(status) ?? 0;
        return {
          status,
          count,
          percentage: roundToTwoDecimals((count / totalExecutions) * 100),
        };
      }),
      byPeriod: [...periodMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, data]) => {
          let label: string;
          if (granularity === 'day') {
            const [, mm, dd] = period.split('-');
            label = `${dd}/${mm}`;
          } else {
            const [yyyy, mm] = period.split('-');
            label = `${monthLabels[Number(mm) - 1]}/${yyyy}`;
          }

          return {
            period,
            label,
            ...data,
            complianceRate: roundToTwoDecimals(
              data.totalExecutions > 0
                ? (data.compliantExecutions / data.totalExecutions) * 100
                : 0,
            ),
          };
        }),
    };
  }

  async getTemplateById(
    context: ChecklistActorContext,
    templateId: string,
  ): Promise<ChecklistTemplateResponse> {
    const template = await prisma.checklistTemplate.findFirst({
      where: { id: templateId, tenantId: context.tenantId },
      include: checklistTemplateInclude,
    });

    if (!template) {
      throw new NotFoundError('Template de checklist não encontrado');
    }

    return this.toTemplateResponse(template);
  }

  async createTemplate(
    context: ChecklistActorContext,
    input: CreateChecklistTemplateInput,
  ): Promise<ChecklistTemplateResponse> {
    const created = await prisma.$transaction(async (tx) => {
      const template = await tx.checklistTemplate.create({
        data: {
          tenantId: context.tenantId,
          name: input.name.trim(),
          vehicleCategory: input.vehicleCategory ?? null,
          items: {
            create: mapTemplateItems(input.items),
          },
        },
        include: checklistTemplateInclude,
      });

      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'CHECKLIST_TEMPLATE_CREATED',
          entity: CHECKLIST_TEMPLATE_ENTITY,
          entityId: template.id,
          changes: toAuditChanges({
            after: {
              name: template.name,
              vehicleCategory: template.vehicleCategory,
              items: template.items.map((item) => ({
                label: item.label,
                required: item.required,
                photoRequired: item.photoRequired,
                displayOrder: item.displayOrder,
              })),
            },
          }),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });

      return template;
    });

    return this.toTemplateResponse(created);
  }

  async replaceTemplate(
    context: ChecklistActorContext,
    templateId: string,
    input: ReplaceChecklistTemplateInput,
  ): Promise<ChecklistTemplateResponse> {
    const existing = await prisma.checklistTemplate.findFirst({
      where: { id: templateId, tenantId: context.tenantId },
      include: checklistTemplateInclude,
    });

    if (!existing) {
      throw new NotFoundError('Template de checklist não encontrado');
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.checklistItem.deleteMany({
        where: {
          templateId,
        },
      });

      const template = await tx.checklistTemplate.update({
        where: { id: templateId },
        data: {
          name: input.name.trim(),
          vehicleCategory: input.vehicleCategory ?? null,
          items: {
            create: mapTemplateItems(input.items),
          },
        },
        include: checklistTemplateInclude,
      });

      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'CHECKLIST_TEMPLATE_UPDATED',
          entity: CHECKLIST_TEMPLATE_ENTITY,
          entityId: template.id,
          changes: toAuditChanges({
            before: {
              name: existing.name,
              vehicleCategory: existing.vehicleCategory,
              items: existing.items.map((item) => ({
                label: item.label,
                required: item.required,
                photoRequired: item.photoRequired,
                displayOrder: item.displayOrder,
              })),
            },
            after: {
              name: template.name,
              vehicleCategory: template.vehicleCategory,
              items: template.items.map((item) => ({
                label: item.label,
                required: item.required,
                photoRequired: item.photoRequired,
                displayOrder: item.displayOrder,
              })),
            },
          }),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });

      return template;
    });

    return this.toTemplateResponse(updated);
  }

  async deleteTemplate(
    context: ChecklistActorContext,
    templateId: string,
  ): Promise<ChecklistTemplateDeletionResult> {
    const existing = await prisma.checklistTemplate.findFirst({
      where: { id: templateId, tenantId: context.tenantId },
      include: checklistTemplateInclude,
    });

    if (!existing) {
      throw new NotFoundError('Template de checklist não encontrado');
    }

    const executionCount = await prisma.checklistExecution.count({
      where: {
        tenantId: context.tenantId,
        templateId,
      },
    });

    if (executionCount > 0) {
      throw new ValidationError('Não é possível excluir um template que já possui execuções');
    }

    await prisma.$transaction(async (tx) => {
      await tx.checklistTemplate.delete({
        where: { id: templateId },
      });

      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'CHECKLIST_TEMPLATE_DELETED',
          entity: CHECKLIST_TEMPLATE_ENTITY,
          entityId: templateId,
          changes: toAuditChanges({
            name: existing.name,
            vehicleCategory: existing.vehicleCategory,
            itemCount: existing.items.length,
          }),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
    });

    return {
      deleted: true,
      templateId,
    };
  }

  private toTemplateResponse(template: ChecklistTemplateRecord): ChecklistTemplateResponse {
    return {
      id: template.id,
      tenantId: template.tenantId,
      name: template.name,
      vehicleCategory: template.vehicleCategory,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      items: template.items.map((item) => ({
        id: item.id,
        label: item.label,
        required: item.required,
        photoRequired: item.photoRequired,
        displayOrder: item.displayOrder,
        createdAt: item.createdAt,
      })),
      itemCount: template.items.length,
    };
  }

  private toExecutionResponse(
    execution: ChecklistExecutionRecord,
    correctiveServiceOrderId: string | null = null,
  ): ChecklistExecutionResponse {
    return {
      id: execution.id,
      tenantId: execution.tenantId,
      templateId: execution.templateId,
      vehicleId: execution.vehicleId,
      driverId: execution.driverId,
      executedAt: execution.executedAt,
      status: execution.status,
      signatureUrl: execution.signatureUrl,
      location: execution.location,
      notes: execution.notes,
      createdByUserId: execution.createdByUserId,
      createdAt: execution.createdAt,
      itemCount: execution.items.length,
      correctiveServiceOrderId,
      template: execution.template,
      vehicle: execution.vehicle,
      driver: execution.driver,
      items: execution.items.map((item) => ({
        id: item.id,
        checklistItemId: item.checklistItemId,
        label: item.label,
        status: item.status,
        photoUrl: item.photoUrl,
        notes: item.notes,
        createdAt: item.createdAt,
      })),
    };
  }
}

export const checklistsService = new ChecklistsService();
