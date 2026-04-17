import type { AiToolDefinition } from '../types';

export const OCR_INVOICE_TOOL: AiToolDefinition = {
  name: 'ocrInvoice',
  description: 'Extrai dados estruturados de notas fiscais de manutencao.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
  },
};
