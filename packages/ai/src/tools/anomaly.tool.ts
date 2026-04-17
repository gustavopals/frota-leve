import type { AiToolDefinition } from '../types';

export const ANOMALY_TOOL: AiToolDefinition = {
  name: 'explainAnomaly',
  description: 'Explica uma anomalia detectada por regras deterministicas.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
  },
};
