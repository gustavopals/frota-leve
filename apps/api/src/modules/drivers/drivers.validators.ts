import { createDriverSchema } from '@frota-leve/shared';
import { z } from 'zod';

// ─── Sort helpers ─────────────────────────────────────────────────────────────

const driverSortFieldSchema = z.enum([
  'createdAt',
  'updatedAt',
  'name',
  'cpf',
  'department',
  'hireDate',
  'score',
  'cnhExpiration',
]);

type DriverSortField = z.infer<typeof driverSortFieldSchema>;

function resolveDriverSort(
  value: {
    order?: string;
    sortBy?: DriverSortField;
    sortOrder?: 'asc' | 'desc';
  },
  defaultSortBy: DriverSortField,
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
  const rawSortBy = normalizedOrder.replace(/^-/, '') as DriverSortField;
  const parsedSortBy = driverSortFieldSchema.safeParse(rawSortBy);

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

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const driverIdParamSchema = z.object({
  id: z.string().uuid('ID do motorista inválido'),
});

export const linkVehicleParamSchema = z.object({
  id: z.string().uuid('ID do motorista inválido'),
  vehicleId: z.string().uuid('ID do veículo inválido'),
});

export const createDriverBodySchema = createDriverSchema;

export const replaceDriverBodySchema = createDriverSchema;

export const listDriversQuerySchema = z
  .object({
    search: z.string().trim().min(1).max(120).optional(),
    department: z.string().trim().min(1).max(80).optional(),
    isActive: z.coerce.boolean().optional(),
    cnhExpiring: z.coerce.boolean().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    order: z.string().trim().min(1).optional(),
    sortBy: driverSortFieldSchema.optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  })
  .transform((value) => ({
    ...value,
    ...resolveDriverSort(value, 'createdAt', 'desc'),
  }));

export const driverImportQuerySchema = z.object({
  preview: z.coerce.boolean().default(false),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type DriverIdParams = z.infer<typeof driverIdParamSchema>;
export type LinkVehicleParams = z.infer<typeof linkVehicleParamSchema>;
export type DriverCreateInput = z.infer<typeof createDriverBodySchema>;
export type DriverReplaceInput = z.infer<typeof replaceDriverBodySchema>;
export type DriverListQueryInput = z.infer<typeof listDriversQuerySchema>;
export type DriverImportQueryInput = z.infer<typeof driverImportQuerySchema>;
