import { DEFAULT_TIRE_REPLACEMENT_THRESHOLD, MAX_TIRE_REPLACEMENT_THRESHOLD } from './tires.alerts';
import {
  TireStatus,
  createTireInspectionSchema,
  createTireSchema,
  moveTireSchema,
  replaceTireSchema,
} from '@frota-leve/shared';
import { z } from 'zod';

const tireSortFieldSchema = z.enum([
  'createdAt',
  'updatedAt',
  'brand',
  'model',
  'size',
  'serialNumber',
  'status',
  'currentGrooveDepth',
  'retreatCount',
  'totalKm',
]);

type TireSortField = z.infer<typeof tireSortFieldSchema>;

function resolveTireSort(
  value: {
    order?: string;
    sortBy?: TireSortField;
    sortOrder?: 'asc' | 'desc';
  },
  defaultSortBy: TireSortField,
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
  const rawSortBy = normalizedOrder.replace(/^-/, '') as TireSortField;
  const parsedSortBy = tireSortFieldSchema.safeParse(rawSortBy);

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

export const tireIdParamSchema = z.object({
  id: z.string().uuid('ID do pneu inválido'),
});

export const createTireBodySchema = createTireSchema;

export const replaceTireBodySchema = replaceTireSchema;

export const createTireInspectionBodySchema = createTireInspectionSchema;

export const moveTireBodySchema = moveTireSchema;

export const tireAlertsQuerySchema = z.object({
  vehicleId: z.string().uuid('ID do veículo inválido').optional(),
  threshold: z.coerce
    .number()
    .positive()
    .max(MAX_TIRE_REPLACEMENT_THRESHOLD)
    .default(DEFAULT_TIRE_REPLACEMENT_THRESHOLD),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const tireStatsQuerySchema = z.object({
  vehicleId: z.string().uuid('ID do veículo inválido').optional(),
  status: z.nativeEnum(TireStatus).optional(),
  brand: z.string().trim().min(1).max(120).optional(),
  model: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  brandLimit: z.coerce.number().int().min(1).max(50).default(10),
});

export const listTiresQuerySchema = z
  .object({
    status: z.nativeEnum(TireStatus).optional(),
    currentVehicleId: z.string().uuid('ID do veículo inválido').optional(),
    search: z.string().trim().min(1).max(120).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    order: z.string().trim().min(1).optional(),
    sortBy: tireSortFieldSchema.optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  })
  .transform((value) => ({
    ...value,
    ...resolveTireSort(value, 'createdAt', 'desc'),
  }));

export type TireIdParams = z.infer<typeof tireIdParamSchema>;
export type CreateTireInput = z.infer<typeof createTireBodySchema>;
export type ReplaceTireInput = z.infer<typeof replaceTireBodySchema>;
export type CreateTireInspectionInput = z.infer<typeof createTireInspectionBodySchema>;
export type MoveTireInput = z.infer<typeof moveTireBodySchema>;
export type TireAlertsQueryInput = z.infer<typeof tireAlertsQuerySchema>;
export type TireStatsQueryInput = z.infer<typeof tireStatsQuerySchema>;
export type ListTiresQueryInput = z.infer<typeof listTiresQuerySchema>;
