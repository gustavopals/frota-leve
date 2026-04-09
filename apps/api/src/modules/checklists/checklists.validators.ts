import { VehicleCategory } from '@frota-leve/database';
import {
  createChecklistExecutionSchema,
  createChecklistTemplateSchema,
  replaceChecklistTemplateSchema,
} from '@frota-leve/shared';
import { z } from 'zod';

const checklistTemplateSortFieldSchema = z.enum(['name', 'vehicleCategory', 'createdAt']);

type ChecklistTemplateSortField = z.infer<typeof checklistTemplateSortFieldSchema>;

function resolveSort(
  value: {
    order?: string;
    sortBy?: ChecklistTemplateSortField;
    sortOrder?: 'asc' | 'desc';
  },
  defaultSortBy: ChecklistTemplateSortField,
  defaultSortOrder: 'asc' | 'desc',
) {
  if (!value.order) {
    return {
      sortBy: value.sortBy ?? defaultSortBy,
      sortOrder: value.sortOrder ?? defaultSortOrder,
    };
  }

  const normalizedOrder = value.order.trim();
  const sortOrder = normalizedOrder.startsWith('-') ? 'desc' : 'asc';
  const rawSortBy = normalizedOrder.replace(/^-/, '') as ChecklistTemplateSortField;
  const parsed = checklistTemplateSortFieldSchema.safeParse(rawSortBy);

  return {
    sortBy: parsed.success ? parsed.data : (value.sortBy ?? defaultSortBy),
    sortOrder,
  };
}

export const checklistTemplateIdParamSchema = z.object({
  id: z.string().uuid('ID do template inválido'),
});

export const createChecklistTemplateBodySchema = createChecklistTemplateSchema;
export const replaceChecklistTemplateBodySchema = replaceChecklistTemplateSchema;
export const createChecklistExecutionBodySchema = createChecklistExecutionSchema;
export const listChecklistExecutionsQuerySchema = z.object({
  vehicleId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const checklistComplianceQuerySchema = z.object({
  templateId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  granularity: z.enum(['day', 'month']).default('month'),
});

export const listChecklistTemplatesQuerySchema = z
  .object({
    vehicleCategory: z.nativeEnum(VehicleCategory).optional(),
    search: z.string().trim().min(1).max(120).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    order: z.string().trim().min(1).optional(),
    sortBy: checklistTemplateSortFieldSchema.optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  })
  .transform((value) => ({
    ...value,
    ...resolveSort(value, 'name', 'asc'),
  }));

export type ChecklistTemplateIdParams = z.infer<typeof checklistTemplateIdParamSchema>;
export type CreateChecklistTemplateInput = z.infer<typeof createChecklistTemplateBodySchema>;
export type ReplaceChecklistTemplateInput = z.infer<typeof replaceChecklistTemplateBodySchema>;
export type ListChecklistTemplatesQueryInput = z.infer<typeof listChecklistTemplatesQuerySchema>;
export type CreateChecklistExecutionInput = z.infer<typeof createChecklistExecutionBodySchema>;
export type ListChecklistExecutionsQueryInput = z.infer<typeof listChecklistExecutionsQuerySchema>;
export type ChecklistComplianceQueryInput = z.infer<typeof checklistComplianceQuerySchema>;
