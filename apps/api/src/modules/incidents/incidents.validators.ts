import { z } from 'zod';
import {
  IncidentStatus,
  IncidentType,
  createIncidentSchema,
  updateIncidentSchema,
} from '@frota-leve/shared';

const incidentSortFieldSchema = z.enum([
  'date',
  'type',
  'status',
  'estimatedCost',
  'actualCost',
  'downtime',
  'createdAt',
]);

type IncidentSortField = z.infer<typeof incidentSortFieldSchema>;

function resolveSort(
  value: { order?: string; sortBy?: IncidentSortField; sortOrder?: 'asc' | 'desc' },
  defaultSortBy: IncidentSortField,
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
  const rawSortBy = normalizedOrder.replace(/^-/, '') as IncidentSortField;
  const parsed = incidentSortFieldSchema.safeParse(rawSortBy);

  return {
    sortBy: parsed.success ? parsed.data : (value.sortBy ?? defaultSortBy),
    sortOrder,
  };
}

export const incidentIdParamSchema = z.object({
  id: z.string().uuid('ID do sinistro inválido'),
});

export const createIncidentBodySchema = createIncidentSchema;
export const updateIncidentBodySchema = updateIncidentSchema;

export const listIncidentsQuerySchema = z
  .object({
    vehicleId: z.string().uuid().optional(),
    driverId: z.string().uuid().optional(),
    status: z.nativeEnum(IncidentStatus).optional(),
    type: z.nativeEnum(IncidentType).optional(),
    search: z.string().trim().min(1).max(120).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    order: z.string().trim().min(1).optional(),
    sortBy: incidentSortFieldSchema.optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  })
  .transform((value) => ({
    ...value,
    ...resolveSort(value, 'date', 'desc'),
  }));

export const incidentStatsQuerySchema = z.object({
  vehicleId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  status: z.nativeEnum(IncidentStatus).optional(),
  type: z.nativeEnum(IncidentType).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  granularity: z.enum(['day', 'month']).default('month'),
});

export type IncidentIdParams = z.infer<typeof incidentIdParamSchema>;
export type CreateIncidentInput = z.infer<typeof createIncidentBodySchema>;
export type UpdateIncidentInput = z.infer<typeof updateIncidentBodySchema>;
export type ListIncidentsQueryInput = z.infer<typeof listIncidentsQuerySchema>;
export type IncidentStatsQueryInput = z.infer<typeof incidentStatsQuerySchema>;
