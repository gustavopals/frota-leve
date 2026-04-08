import { z } from 'zod';
import { FineSeverity, FineStatus, createFineSchema, updateFineSchema } from '@frota-leve/shared';

const fineSortFieldSchema = z.enum([
  'date',
  'dueDate',
  'amount',
  'severity',
  'status',
  'createdAt',
]);

type FineSortField = z.infer<typeof fineSortFieldSchema>;

function resolveSort(
  value: { order?: string; sortBy?: FineSortField; sortOrder?: 'asc' | 'desc' },
  defaultSortBy: FineSortField,
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
  const rawSortBy = normalizedOrder.replace(/^-/, '') as FineSortField;
  const parsed = fineSortFieldSchema.safeParse(rawSortBy);

  return {
    sortBy: parsed.success ? parsed.data : (value.sortBy ?? defaultSortBy),
    sortOrder,
  };
}

export const fineIdParamSchema = z.object({
  id: z.string().uuid('ID da multa inválido'),
});

export const createFineBodySchema = createFineSchema;
export const updateFineBodySchema = updateFineSchema;

export const listFinesQuerySchema = z
  .object({
    vehicleId: z.string().uuid().optional(),
    driverId: z.string().uuid().optional(),
    status: z.nativeEnum(FineStatus).optional(),
    severity: z.nativeEnum(FineSeverity).optional(),
    search: z.string().trim().min(1).max(120).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    order: z.string().trim().min(1).optional(),
    sortBy: fineSortFieldSchema.optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  })
  .transform((value) => ({
    ...value,
    ...resolveSort(value, 'date', 'desc'),
  }));

export const fineStatsQuerySchema = z.object({
  vehicleId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  granularity: z.enum(['day', 'month']).default('month'),
});

export type FineIdParams = z.infer<typeof fineIdParamSchema>;
export type CreateFineInput = z.infer<typeof createFineBodySchema>;
export type UpdateFineInput = z.infer<typeof updateFineBodySchema>;
export type ListFinesQueryInput = z.infer<typeof listFinesQuerySchema>;
export type FineStatsQueryInput = z.infer<typeof fineStatsQuerySchema>;
