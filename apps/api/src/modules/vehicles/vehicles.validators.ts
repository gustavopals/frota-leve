import { createVehicleSchema, FuelType, VehicleCategory, VehicleStatus } from '@frota-leve/shared';
import { z } from 'zod';

const vehicleFilterShape = {
  status: z.nativeEnum(VehicleStatus).optional(),
  category: z.nativeEnum(VehicleCategory).optional(),
  fuelType: z.nativeEnum(FuelType).optional(),
  search: z.string().trim().min(1).max(120).optional(),
};

const vehicleSortFieldSchema = z.enum([
  'createdAt',
  'updatedAt',
  'plate',
  'brand',
  'model',
  'year',
  'yearModel',
  'currentMileage',
  'status',
  'category',
  'fuelType',
]);

type VehicleSortField = z.infer<typeof vehicleSortFieldSchema>;

function resolveVehicleSort(
  value: {
    order?: string;
    sortBy?: VehicleSortField;
    sortOrder?: 'asc' | 'desc';
  },
  defaultSortBy: VehicleSortField,
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
  const rawSortBy = normalizedOrder.replace(/^-/, '') as VehicleSortField;
  const parsedSortBy = vehicleSortFieldSchema.safeParse(rawSortBy);

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

const replaceVehicleSchema = z.object({
  ...createVehicleSchema.shape,
  status: z.nativeEnum(VehicleStatus).optional(),
  currentMileage: z.coerce
    .number()
    .int()
    .min(0, 'Quilometragem atual deve ser maior ou igual a zero'),
});

function validateVehicleConsistency(
  record: {
    year?: number;
    yearModel?: number;
  },
  ctx: z.RefinementCtx,
): void {
  if (
    typeof record.year === 'number' &&
    typeof record.yearModel === 'number' &&
    record.yearModel < record.year
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['yearModel'],
      message: 'Ano modelo não pode ser menor que o ano de fabricação',
    });
  }
}

export const vehicleIdParamSchema = z.object({
  id: z.string().uuid('ID do veículo inválido'),
});

export const createVehicleBodySchema = createVehicleSchema.superRefine(validateVehicleConsistency);

export const replaceVehicleBodySchema = replaceVehicleSchema.superRefine(
  validateVehicleConsistency,
);

export const listVehiclesQuerySchema = z
  .object({
    ...vehicleFilterShape,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    order: z.string().trim().min(1).optional(),
    sortBy: vehicleSortFieldSchema.optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  })
  .transform((value) => ({
    ...value,
    ...resolveVehicleSort(value, 'createdAt', 'desc'),
  }));

export const exportVehiclesQuerySchema = z.object({
  ...vehicleFilterShape,
  sortBy: vehicleSortFieldSchema.default('plate'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const vehicleStatsQuerySchema = z.object(vehicleFilterShape);

export const vehicleImportQuerySchema = z.object({
  preview: z.coerce.boolean().default(false),
});

export const updateVehicleStatusBodySchema = z.object({
  status: z.nativeEnum(VehicleStatus),
});

export const updateVehicleMileageBodySchema = z.object({
  mileage: z.coerce.number().int().min(0, 'Quilometragem deve ser maior ou igual a zero'),
});

export type VehicleIdParams = z.infer<typeof vehicleIdParamSchema>;
export type VehicleCreateInput = z.infer<typeof createVehicleBodySchema>;
export type VehicleReplaceInput = z.infer<typeof replaceVehicleBodySchema>;
export type VehicleListQueryInput = z.infer<typeof listVehiclesQuerySchema>;
export type VehicleExportQueryInput = z.infer<typeof exportVehiclesQuerySchema>;
export type VehicleStatsQueryInput = z.infer<typeof vehicleStatsQuerySchema>;
export type VehicleImportQueryInput = z.infer<typeof vehicleImportQuerySchema>;
export type VehicleStatusUpdateInput = z.infer<typeof updateVehicleStatusBodySchema>;
export type VehicleMileageUpdateInput = z.infer<typeof updateVehicleMileageBodySchema>;
