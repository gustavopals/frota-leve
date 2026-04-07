import { z } from 'zod';
import { FuelType } from '../enums/fuel-type.enum';

export const createFuelRecordSchema = z.object({
  vehicleId: z.string().uuid('ID do veículo inválido'),
  date: z.coerce.date({ message: 'Data inválida' }),
  mileage: z.number().int().min(0, 'Quilometragem deve ser positiva'),
  liters: z.number().positive('Litros deve ser positivo'),
  pricePerLiter: z.number().positive('Preço por litro deve ser positivo'),
  totalCost: z.number().positive('Custo total deve ser positivo'),
  fuelType: z.nativeEnum(FuelType),
  fullTank: z.boolean().default(true),
  gasStation: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateFuelRecordDto = z.infer<typeof createFuelRecordSchema>;
