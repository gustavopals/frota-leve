import { z } from 'zod';

function optionalTrimmedString(maxLength: number) {
  return z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }, z.string().trim().max(maxLength).optional().nullable());
}

export const createTireInspectionSchema = z.object({
  vehicleId: z.string().uuid('ID do veículo inválido'),
  date: z.coerce.date({ message: 'Data da inspeção inválida' }),
  grooveDepth: z.coerce.number().nonnegative('Sulco medido deve ser maior ou igual a zero'),
  position: z.string().trim().min(1, 'Posição obrigatória').max(80),
  photos: z.array(z.string().trim().url('URL da foto inválida')).max(10).optional(),
  notes: optionalTrimmedString(4000),
});

export type CreateTireInspectionDto = z.infer<typeof createTireInspectionSchema>;
