import { z } from 'zod';

export const moveTireSchema = z.object({
  vehicleId: z.string().uuid('ID do veículo inválido'),
  position: z.string().trim().min(1, 'Posição obrigatória').max(80),
});

export type MoveTireDto = z.infer<typeof moveTireSchema>;
