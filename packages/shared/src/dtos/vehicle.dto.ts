import { z } from 'zod';
import { FuelType } from '../enums/fuel-type.enum';
import { VehicleCategory } from '../enums/vehicle-category.enum';
import { VehicleStatus } from '../enums/vehicle-status.enum';
import { isValidPlate } from '../utils/validation.utils';

export const createVehicleSchema = z.object({
  plate: z
    .string()
    .transform((v) => v.toUpperCase().replace(/\s/g, ''))
    .refine(isValidPlate, 'Placa inválida — use o padrão antigo (ABC-1234) ou Mercosul (ABC1D23)'),
  renavam: z.string().optional(),
  chassis: z.string().optional(),
  brand: z.string().min(1, 'Marca obrigatória'),
  model: z.string().min(1, 'Modelo obrigatório'),
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1),
  yearModel: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 2),
  color: z.string().optional(),
  fuelType: z.nativeEnum(FuelType),
  category: z.nativeEnum(VehicleCategory),
  currentMileage: z.number().int().min(0).default(0),
  notes: z.string().optional(),
});

export const updateVehicleSchema = createVehicleSchema
  .partial()
  .extend({ status: z.nativeEnum(VehicleStatus).optional() });

export type CreateVehicleDto = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleDto = z.infer<typeof updateVehicleSchema>;
