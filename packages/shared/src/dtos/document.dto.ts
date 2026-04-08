import { z } from 'zod';
import { DocumentType } from '../enums/document-type.enum';

const MAX_DOCUMENT_FILE_URL_LENGTH = 6_000_000;

function optionalNullableUuid(message: string) {
  return z.preprocess((value) => {
    if (value === '' || value === undefined) {
      return undefined;
    }

    return value;
  }, z.string().uuid(message).optional().nullable());
}

function optionalTrimmedString(maxLength: number) {
  return z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }, z.string().trim().max(maxLength).optional().nullable());
}

function optionalCoercedNonNegativeNumber() {
  return z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) {
      return undefined;
    }

    return value;
  }, z.coerce.number().nonnegative('Valor deve ser maior ou igual a zero').optional().nullable());
}

const documentBaseSchema = z
  .object({
    vehicleId: optionalNullableUuid('ID do veículo inválido'),
    driverId: optionalNullableUuid('ID do motorista inválido'),
    type: z.nativeEnum(DocumentType),
    description: z.string().trim().min(1, 'Descrição obrigatória').max(240),
    expirationDate: z.coerce.date({ message: 'Data de vencimento inválida' }),
    alertDaysBefore: z.coerce
      .number()
      .int('Antecedência do alerta deve ser um número inteiro')
      .min(0, 'Antecedência do alerta não pode ser negativa')
      .max(365, 'Antecedência do alerta deve ser de no máximo 365 dias')
      .default(30),
    cost: optionalCoercedNonNegativeNumber(),
    fileUrl: z
      .string()
      .trim()
      .url('URL do arquivo inválida')
      .max(MAX_DOCUMENT_FILE_URL_LENGTH, 'Arquivo excede o tamanho máximo permitido'),
    notes: optionalTrimmedString(4000),
  })
  .superRefine((value, ctx) => {
    if (!value.vehicleId && !value.driverId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe um veículo ou motorista para vincular o documento',
        path: ['vehicleId'],
      });
    }

    if (value.type === DocumentType.CNH && !value.driverId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CNH deve estar vinculada a um motorista',
        path: ['driverId'],
      });
    }
  });

export const createDocumentSchema = documentBaseSchema;

export const replaceDocumentSchema = documentBaseSchema;

export type CreateDocumentDto = z.infer<typeof createDocumentSchema>;
export type ReplaceDocumentDto = z.infer<typeof replaceDocumentSchema>;
