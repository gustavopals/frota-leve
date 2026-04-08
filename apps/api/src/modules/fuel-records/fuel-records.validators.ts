import { createFuelRecordSchema, replaceFuelRecordSchema } from '@frota-leve/shared';
import { FuelType } from '@frota-leve/database';
import { z } from 'zod';

// ─── Sort helpers ─────────────────────────────────────────────────────────────

const fuelRecordSortFieldSchema = z.enum([
  'date',
  'mileage',
  'liters',
  'totalCost',
  'kmPerLiter',
  'createdAt',
]);

type FuelRecordSortField = z.infer<typeof fuelRecordSortFieldSchema>;

function resolveFuelRecordSort(
  value: {
    order?: string;
    sortBy?: FuelRecordSortField;
    sortOrder?: 'asc' | 'desc';
  },
  defaultSortBy: FuelRecordSortField,
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
  const rawSortBy = normalizedOrder.replace(/^-/, '') as FuelRecordSortField;
  const parsedSortBy = fuelRecordSortFieldSchema.safeParse(rawSortBy);

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

export const fuelRecordIdParamSchema = z.object({
  id: z.string().uuid('ID do abastecimento inválido'),
});

export const vehicleIdParamSchema = z.object({
  vehicleId: z.string().uuid('ID do veículo inválido'),
});

export const createFuelRecordBodySchema = createFuelRecordSchema;

export const replaceFuelRecordBodySchema = replaceFuelRecordSchema;

const dateRangeShape = {
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
};

export const listFuelRecordsQuerySchema = z
  .object({
    vehicleId: z.string().uuid().optional(),
    driverId: z.string().uuid().optional(),
    fuelType: z.nativeEnum(FuelType).optional(),
    gasStation: z.string().trim().min(1).max(120).optional(),
    anomaly: z.coerce.boolean().optional(),
    ...dateRangeShape,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    order: z.string().trim().min(1).optional(),
    sortBy: fuelRecordSortFieldSchema.optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  })
  .transform((value) => ({
    ...value,
    ...resolveFuelRecordSort(value, 'date', 'desc'),
  }));

export const fuelRecordStatsQuerySchema = z.object({
  vehicleId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  fuelType: z.nativeEnum(FuelType).optional(),
  gasStation: z.string().trim().min(1).max(120).optional(),
  anomaly: z.coerce.boolean().optional(),
  ...dateRangeShape,
});

export const fuelRecordRankingQuerySchema = z.object({
  vehicleId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  fuelType: z.nativeEnum(FuelType).optional(),
  gasStation: z.string().trim().min(1).max(120).optional(),
  anomaly: z.coerce.boolean().optional(),
  ...dateRangeShape,
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type FuelRecordIdParams = z.infer<typeof fuelRecordIdParamSchema>;
export type VehicleIdParam = z.infer<typeof vehicleIdParamSchema>;
export type FuelRecordCreateInput = z.infer<typeof createFuelRecordBodySchema>;
export type FuelRecordReplaceInput = z.infer<typeof replaceFuelRecordBodySchema>;
export type FuelRecordListQueryInput = z.infer<typeof listFuelRecordsQuerySchema>;
export type FuelRecordStatsQueryInput = z.infer<typeof fuelRecordStatsQuerySchema>;
export type FuelRecordRankingQueryInput = z.infer<typeof fuelRecordRankingQuerySchema>;
