import { z } from 'zod';
import type { AiToolDefinition } from '../types';

const ACTION_KINDS = ['TRAINING', 'BONUS', 'WARNING', 'NONE'] as const;

/** Contrato de saída das recomendações de score (TASK 3.7.3). */
export const DRIVER_SCORING_TOOL: AiToolDefinition = {
  name: 'driverScoring',
  description:
    'Registra recomendacoes para o score de um motorista ja calculado por regras ' +
    'deterministicas. Nao recalcule o score nem questione os numeros recebidos.',
  inputSchema: {
    type: 'object',
    properties: {
      strengths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Pontos fortes observados, no maximo 3.',
      },
      improvements: {
        type: 'array',
        items: { type: 'string' },
        description: 'Pontos a melhorar, no maximo 3.',
      },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: [...ACTION_KINDS] },
            description: { type: 'string' },
          },
          required: ['kind', 'description'],
          additionalProperties: false,
        },
      },
    },
    required: ['strengths', 'improvements', 'actions'],
    additionalProperties: false,
  },
};

export const driverRecommendationSchema = z.object({
  strengths: z.array(z.string().min(1)).max(5),
  improvements: z.array(z.string().min(1)).max(5),
  actions: z
    .array(
      z.object({
        kind: z.enum(ACTION_KINDS),
        description: z.string().min(1),
      }),
    )
    .max(5),
});

export type DriverRecommendation = z.infer<typeof driverRecommendationSchema>;
