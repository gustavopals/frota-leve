import { AIReportKind, AIReportStatus } from '@frota-leve/database';
import { z } from 'zod';

const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Janela aceita para geração sob demanda: no máximo 12 meses atrás (TASK 3.5.6). */
export const MAX_MONTHS_BACK = 12;

export const listReportsQuerySchema = z
  .object({
    kind: z.nativeEnum(AIReportKind).optional(),
    status: z.nativeEnum(AIReportStatus).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  })
  .strict();

export const reportIdParamsSchema = z.object({ id: z.uuid('ID do relatório inválido') }).strict();

export const onDemandReportSchema = z
  .object({
    period: z.string().regex(PERIOD_REGEX, 'Período deve estar no formato YYYY-MM'),
  })
  .strict();

export type ListReportsQueryInput = z.infer<typeof listReportsQuerySchema>;
export type ReportIdParams = z.infer<typeof reportIdParamsSchema>;
export type OnDemandReportInput = z.infer<typeof onDemandReportSchema>;
