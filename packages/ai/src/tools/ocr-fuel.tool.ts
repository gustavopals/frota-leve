import type { AiToolDefinition } from '../types';

export const OCR_FUEL_TOOL: AiToolDefinition = {
  name: 'ocrFuel',
  description: 'Extrai dados estruturados de cupons de abastecimento.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
  },
};
