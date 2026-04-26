import type { AiToolDefinition } from '../types';

export const DRIVER_SCORING_TOOL: AiToolDefinition = {
  name: 'driverScoring',
  description: 'Gera recomendacoes estruturadas para score de motorista.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
  },
};
