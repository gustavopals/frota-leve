import type { ZodTypeAny, z } from 'zod';

/**
 * Contexto seguro disponível para a execução de uma tool de IA.
 * Toda tool DEVE escopar suas queries por `tenantId` — jamais executar consultas globais.
 */
export interface AIToolContext {
  tenantId: string;
  userId: string;
}

/**
 * Definição de uma tool whitelisted exposta para o assistente.
 * O `inputSchema` (JSON Schema) é enviado para Claude; o Zod é usado para validar a entrada
 * antes de executar a query no banco.
 */
export interface AITool<TSchema extends ZodTypeAny = ZodTypeAny> {
  name: string;
  description: string;
  zodSchema: TSchema;
  inputSchema: { type: 'object'; [key: string]: unknown };
  execute: (input: z.infer<TSchema>, ctx: AIToolContext) => Promise<unknown>;
}
