import { z } from 'zod';

/**
 * Aceita um período no formato `YYYY-MM`. Quando ausente, o serviço usa o mês corrente.
 */
export const usageQuerySchema = z
  .object({
    period: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Período deve estar no formato YYYY-MM')
      .optional(),
  })
  .strict();

export type UsageQueryInput = z.infer<typeof usageQuerySchema>;
