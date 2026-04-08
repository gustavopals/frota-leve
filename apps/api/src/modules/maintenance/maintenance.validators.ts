import { createMaintenancePlanSchema, replaceMaintenancePlanSchema } from '@frota-leve/shared';
import { MaintenanceType } from '@frota-leve/database';
import { z } from 'zod';

const maintenancePlanSortFieldSchema = z.enum([
  'name',
  'type',
  'nextDueAt',
  'nextDueMileage',
  'createdAt',
  'updatedAt',
]);

type MaintenancePlanSortField = z.infer<typeof maintenancePlanSortFieldSchema>;

function resolveMaintenancePlanSort(
  value: {
    order?: string;
    sortBy?: MaintenancePlanSortField;
    sortOrder?: 'asc' | 'desc';
  },
  defaultSortBy: MaintenancePlanSortField,
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
  const rawSortBy = normalizedOrder.replace(/^-/, '') as MaintenancePlanSortField;
  const parsedSortBy = maintenancePlanSortFieldSchema.safeParse(rawSortBy);

  if (!parsedSortBy.success) {
    return {
      sortBy: value.sortBy ?? defaultSortBy,
      sortOrder: value.sortOrder ?? defaultSortOrder,
    };
  }

  return {
    sortBy: parsedSortBy.data,
    sortOrder,
  };
}

export const maintenancePlanIdParamSchema = z.object({
  id: z.string().uuid('ID do plano de manutenção inválido'),
});

export const createMaintenancePlanBodySchema = createMaintenancePlanSchema;

export const replaceMaintenancePlanBodySchema = replaceMaintenancePlanSchema;

export const listMaintenancePlansQuerySchema = z
  .object({
    vehicleId: z.string().uuid().optional(),
    type: z.nativeEnum(MaintenanceType).optional(),
    isActive: z.coerce.boolean().optional(),
    search: z.string().trim().min(1).max(120).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    order: z.string().trim().min(1).optional(),
    sortBy: maintenancePlanSortFieldSchema.optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  })
  .transform((value) => ({
    ...value,
    ...resolveMaintenancePlanSort(value, 'createdAt', 'desc'),
  }));

export const maintenanceAlertsQuerySchema = z.object({
  vehicleId: z.string().uuid().optional(),
  daysAhead: z.coerce.number().int().min(1).max(365).default(30),
  kmAhead: z.coerce.number().int().min(1).max(50000).default(1000),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const maintenanceStatsQuerySchema = z.object({
  vehicleId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type MaintenancePlanIdParams = z.infer<typeof maintenancePlanIdParamSchema>;
export type MaintenancePlanCreateInput = z.infer<typeof createMaintenancePlanBodySchema>;
export type MaintenancePlanReplaceInput = z.infer<typeof replaceMaintenancePlanBodySchema>;
export type MaintenancePlanListQueryInput = z.infer<typeof listMaintenancePlansQuerySchema>;
export type MaintenanceAlertsQueryInput = z.infer<typeof maintenanceAlertsQuerySchema>;
export type MaintenanceStatsQueryInput = z.infer<typeof maintenanceStatsQuerySchema>;
