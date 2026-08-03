import { z } from 'zod';
import type { AiToolDefinition } from '../types';

const FUEL_TYPES = ['GASOLINE', 'ETHANOL', 'DIESEL', 'DIESEL_S10', 'GNV', 'ELECTRIC', 'FLEX'];

/** Contrato de saída do OCR de cupom (TASK 3.6.1). */
export const OCR_FUEL_TOOL: AiToolDefinition = {
  name: 'ocrFuel',
  description:
    'Registra os dados extraidos de um cupom de abastecimento. Use null nos campos ausentes ' +
    'ou ilegiveis; nunca invente valores.',
  inputSchema: {
    type: 'object',
    properties: {
      liters: { type: ['number', 'null'], description: 'Litros abastecidos.' },
      totalCost: { type: ['number', 'null'], description: 'Valor total pago em reais.' },
      pricePerLiter: { type: ['number', 'null'], description: 'Preco por litro em reais.' },
      gasStation: { type: ['string', 'null'], description: 'Nome do posto.' },
      fuelType: { type: ['string', 'null'], enum: [...FUEL_TYPES, null] },
      date: { type: ['string', 'null'], description: 'Data do abastecimento em ISO 8601.' },
      odometerKm: { type: ['number', 'null'], description: 'Odometro, se impresso no cupom.' },
      cnpj: { type: ['string', 'null'], description: 'CNPJ do posto, somente digitos.' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      fieldsConfidence: {
        type: 'object',
        description: 'Confianca de 0 a 1 por campo extraido.',
        additionalProperties: { type: 'number', minimum: 0, maximum: 1 },
      },
    },
    required: ['liters', 'totalCost', 'confidence', 'fieldsConfidence'],
    additionalProperties: false,
  },
};

export const ocrFuelResultSchema = z.object({
  liters: z.number().positive().nullable(),
  totalCost: z.number().nonnegative().nullable(),
  pricePerLiter: z.number().nonnegative().nullable().default(null),
  gasStation: z.string().nullable().default(null),
  fuelType: z
    .enum(FUEL_TYPES as [string, ...string[]])
    .nullable()
    .default(null),
  date: z.string().nullable().default(null),
  odometerKm: z.number().nonnegative().nullable().default(null),
  cnpj: z.string().nullable().default(null),
  confidence: z.number().min(0).max(1),
  fieldsConfidence: z.record(z.string(), z.number().min(0).max(1)).default({}),
});

export type OcrFuelResult = z.infer<typeof ocrFuelResultSchema>;
