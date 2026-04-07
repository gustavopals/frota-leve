import { z } from 'zod';
import { FuelType } from '../enums/fuel-type.enum';
import { VehicleCategory } from '../enums/vehicle-category.enum';
import { VehicleStatus } from '../enums/vehicle-status.enum';
import { isValidPlate } from '../utils/validation.utils';

function optionalTrimmedString() {
  return z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }, z.string().trim().optional());
}

function optionalCoercedPositiveNumber() {
  return z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }

    return value;
  }, z.coerce.number().positive().optional());
}

function optionalCoercedNonNegativeNumber() {
  return z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }

    return value;
  }, z.coerce.number().nonnegative().optional());
}

function optionalCoercedDate() {
  return z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }

    return value;
  }, z.coerce.date().optional());
}

export const createVehicleSchema = z.object({
  plate: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase().replace(/[\s-]/g, ''))
    .refine(isValidPlate, 'Placa inválida — use o padrão antigo (ABC-1234) ou Mercosul (ABC1D23)'),
  renavam: optionalTrimmedString(),
  chassis: optionalTrimmedString(),
  brand: z.string().trim().min(1, 'Marca obrigatória'),
  model: z.string().trim().min(1, 'Modelo obrigatório'),
  year: z.coerce
    .number()
    .int()
    .min(1950)
    .max(new Date().getFullYear() + 1),
  yearModel: z.coerce
    .number()
    .int()
    .min(1950)
    .max(new Date().getFullYear() + 2),
  color: optionalTrimmedString(),
  fuelType: z.nativeEnum(FuelType),
  category: z.nativeEnum(VehicleCategory),
  status: z.nativeEnum(VehicleStatus).default(VehicleStatus.ACTIVE),
  currentMileage: z.coerce.number().int().min(0).default(0),
  expectedConsumption: optionalCoercedPositiveNumber(),
  acquisitionDate: optionalCoercedDate(),
  acquisitionValue: optionalCoercedNonNegativeNumber(),
  photos: z.array(z.string().url()).max(4).optional(),
  notes: z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }, z.string().trim().max(4000).optional()),
  currentDriverId: z.string().uuid().optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial();

export type CreateVehicleDto = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleDto = z.infer<typeof updateVehicleSchema>;
