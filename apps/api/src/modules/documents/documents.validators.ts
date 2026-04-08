import { createDocumentSchema, replaceDocumentSchema } from '@frota-leve/shared';
import { DocumentStatus, DocumentType } from '@frota-leve/database';
import { z } from 'zod';

const documentSortFieldSchema = z.enum([
  'expirationDate',
  'createdAt',
  'type',
  'status',
  'description',
  'cost',
]);

type DocumentSortField = z.infer<typeof documentSortFieldSchema>;

function resolveDocumentSort(
  value: {
    order?: string;
    sortBy?: DocumentSortField;
    sortOrder?: 'asc' | 'desc';
  },
  defaultSortBy: DocumentSortField,
  defaultSortOrder: 'asc' | 'desc',
) {
  if (!value.order) {
    return {
      sortBy: value.sortBy ?? defaultSortBy,
      sortOrder: value.sortOrder ?? defaultSortOrder,
    };
  }

  const normalizedOrder = value.order.trim();
  const sortOrder = normalizedOrder.startsWith('-') ? 'desc' : 'asc';
  const rawSortBy = normalizedOrder.replace(/^-/, '') as DocumentSortField;
  const parsedSortBy = documentSortFieldSchema.safeParse(rawSortBy);

  if (!parsedSortBy.success) {
    return {
      sortBy: value.sortBy ?? defaultSortBy,
      sortOrder: value.sortOrder ?? defaultSortOrder,
    };
  }

  return {
    sortBy: parsedSortBy.data,
    sortOrder,
  };
}

export const documentIdParamSchema = z.object({
  id: z.string().uuid('ID do documento inválido'),
});

export const createDocumentBodySchema = createDocumentSchema;

export const replaceDocumentBodySchema = replaceDocumentSchema;

export const pendingDocumentsQuerySchema = z.object({
  type: z.nativeEnum(DocumentType).optional(),
  vehicleId: z.string().uuid('ID do veículo inválido').optional(),
  driverId: z.string().uuid('ID do motorista inválido').optional(),
});

export const listDocumentsQuerySchema = z
  .object({
    type: z.nativeEnum(DocumentType).optional(),
    vehicleId: z.string().uuid('ID do veículo inválido').optional(),
    driverId: z.string().uuid('ID do motorista inválido').optional(),
    status: z.nativeEnum(DocumentStatus).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    order: z.string().trim().min(1).optional(),
    sortBy: documentSortFieldSchema.optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  })
  .transform((value) => ({
    ...value,
    ...resolveDocumentSort(value, 'expirationDate', 'asc'),
  }));

export type DocumentIdParams = z.infer<typeof documentIdParamSchema>;
export type DocumentCreateInput = z.infer<typeof createDocumentBodySchema>;
export type DocumentReplaceInput = z.infer<typeof replaceDocumentBodySchema>;
export type PendingDocumentsQueryInput = z.infer<typeof pendingDocumentsQuerySchema>;
export type DocumentListQueryInput = z.infer<typeof listDocumentsQuerySchema>;
