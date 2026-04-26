import { z } from 'zod';

export const createSessionSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
  })
  .strict();
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

export const listSessionsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(20),
    includeArchived: z.coerce.boolean().default(false),
  })
  .strict();
export type ListSessionsQueryInput = z.infer<typeof listSessionsQuerySchema>;

export const sessionIdParamsSchema = z
  .object({
    id: z.string().uuid('id inválido'),
  })
  .strict();
export type SessionIdParams = z.infer<typeof sessionIdParamsSchema>;

export const sendMessageSchema = z
  .object({
    content: z.string().min(1, 'Mensagem vazia').max(2000, 'Mensagem muito longa (máx 2000)'),
  })
  .strict();
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
