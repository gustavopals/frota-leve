import { z } from 'zod';
import type { AiToolDefinition } from '../types';

/** Contrato de saída do OCR de nota fiscal (TASK 3.6.1). */
export const OCR_INVOICE_TOOL: AiToolDefinition = {
  name: 'ocrInvoice',
  description:
    'Registra os dados extraidos de uma nota fiscal de manutencao. Use null nos campos ' +
    'ausentes ou ilegiveis; nunca invente valores.',
  inputSchema: {
    type: 'object',
    properties: {
      supplier: { type: ['string', 'null'], description: 'Razao social do fornecedor.' },
      cnpj: { type: ['string', 'null'], description: 'CNPJ do fornecedor, somente digitos.' },
      issueDate: { type: ['string', 'null'], description: 'Data de emissao em ISO 8601.' },
      totalValue: { type: ['number', 'null'], description: 'Valor total da nota em reais.' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            qty: { type: ['number', 'null'] },
            unitValue: { type: ['number', 'null'] },
            totalValue: { type: ['number', 'null'] },
          },
          required: ['description'],
          additionalProperties: false,
        },
      },
      taxes: { type: ['number', 'null'], description: 'Total de tributos, se destacado.' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      fieldsConfidence: {
        type: 'object',
        additionalProperties: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    required: ['supplier', 'totalValue', 'items', 'confidence', 'fieldsConfidence'],
    additionalProperties: false,
  },
};

export const ocrInvoiceResultSchema = z.object({
  supplier: z.string().nullable(),
  cnpj: z.string().nullable().default(null),
  issueDate: z.string().nullable().default(null),
  totalValue: z.number().nonnegative().nullable(),
  items: z
    .array(
      z.object({
        description: z.string(),
        qty: z.number().nullable().default(null),
        unitValue: z.number().nullable().default(null),
        totalValue: z.number().nullable().default(null),
      }),
    )
    .default([]),
  taxes: z.number().nullable().default(null),
  confidence: z.number().min(0).max(1),
  fieldsConfidence: z.record(z.string(), z.number().min(0).max(1)).default({}),
});

export type OcrInvoiceResult = z.infer<typeof ocrInvoiceResultSchema>;
