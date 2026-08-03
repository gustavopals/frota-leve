import { z } from 'zod';
import { AIAnomalySeverity, AIAnomalyStatus, AIAnomalyKind } from '@frota-leve/database';
import { prisma } from '../../../config/database';
import type { AITool } from './types';

const inputSchema = z.object({
  severity: z.nativeEnum(AIAnomalySeverity).optional(),
  kind: z.nativeEnum(AIAnomalyKind).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const listOpenAnomaliesTool: AITool<typeof inputSchema> = {
  name: 'listOpenAnomalies',
  description:
    'Lista anomalias detectadas pelo sistema que ainda não foram resolvidas (status OPEN). ' +
    'Filtros opcionais por severidade e tipo. Use para "tem alguma anomalia?", "alertas de IA pendentes".',
  zodSchema: inputSchema,
  inputSchema: {
    type: 'object',
    properties: {
      severity: {
        type: 'string',
        enum: Object.values(AIAnomalySeverity),
        description: 'LOW, MED, HIGH.',
      },
      kind: {
        type: 'string',
        enum: Object.values(AIAnomalyKind),
      },
      limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
    },
    additionalProperties: false,
  },
  execute: async (input, ctx) => {
    const anomalies = await prisma.aIAnomaly.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: AIAnomalyStatus.OPEN,
        ...(input.severity ? { severity: input.severity } : {}),
        ...(input.kind ? { kind: input.kind } : {}),
      },
      take: input.limit,
      orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
      select: {
        id: true,
        kind: true,
        severity: true,
        entityType: true,
        entityId: true,
        score: true,
        message: true,
        detectedAt: true,
      },
    });

    return { total: anomalies.length, anomalies };
  },
};
