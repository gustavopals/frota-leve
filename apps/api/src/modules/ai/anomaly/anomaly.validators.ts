import { AIAnomalyKind, AIAnomalySeverity, AIAnomalyStatus } from '@frota-leve/database';
import { z } from 'zod';

export const listAnomaliesQuerySchema = z
  .object({
    status: z.nativeEnum(AIAnomalyStatus).optional(),
    kind: z.nativeEnum(AIAnomalyKind).optional(),
    severity: z.nativeEnum(AIAnomalySeverity).optional(),
    entityId: z.uuid('ID da entidade inválido').optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const anomalyIdParamsSchema = z
  .object({
    id: z.uuid('ID da anomalia inválido'),
  })
  .strict();

export type ListAnomaliesQueryInput = z.infer<typeof listAnomaliesQuerySchema>;
export type AnomalyIdParams = z.infer<typeof anomalyIdParamsSchema>;
