import type { AiToolDefinition } from '../types';

/** Limite de `AIAnomaly.message` definido pela TASK 3.4.3. */
export const ANOMALY_MESSAGE_MAX_CHARS = 280;

/**
 * Tool forçada usada para arrancar do modelo uma saída estruturada.
 *
 * A IA não decide se algo é anomalia — isso já foi resolvido pelas regras
 * determinísticas. Aqui ela apenas redige a explicação.
 */
export const ANOMALY_TOOL: AiToolDefinition = {
  name: 'explainAnomaly',
  description:
    'Registra a explicacao de uma anomalia ja detectada por regras deterministicas. ' +
    'Nao avalie se a anomalia procede: ela e um fato de entrada.',
  inputSchema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        maxLength: ANOMALY_MESSAGE_MAX_CHARS,
        description:
          'Explicacao em portugues do Brasil, no maximo 280 caracteres, contendo a causa ' +
          'provavel e uma recomendacao pratica. Sem saudacao e sem repetir os numeros brutos.',
      },
    },
    required: ['message'],
    additionalProperties: false,
  },
};
