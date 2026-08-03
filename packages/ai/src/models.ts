import { AI_MODEL_HAIKU, AI_MODEL_OPUS, AI_MODEL_SONNET } from '@frota-leve/shared';
import type { AiModelDefinition } from './types';

export { AI_MODEL_HAIKU, AI_MODEL_OPUS, AI_MODEL_SONNET };

export const AI_MODELS: readonly AiModelDefinition[] = [
  { id: AI_MODEL_HAIKU, label: 'Claude Haiku 4.5' },
  { id: AI_MODEL_SONNET, label: 'Claude Sonnet 5' },
  { id: AI_MODEL_OPUS, label: 'Claude Opus 5' },
] as const;

/**
 * Sonnet 5 e Opus 5 removeram os parametros de sampling (temperature/top_p/top_k)
 * e o thinking manual por budget_tokens — enviar qualquer um deles retorna HTTP 400.
 * A profundidade de raciocinio é controlada por `thinking` + `output_config.effort`.
 * Haiku 4.5 é da geracao anterior e nao aceita `effort`.
 */
export const AI_MODELS_WITHOUT_SAMPLING: readonly string[] = [
  AI_MODEL_SONNET,
  AI_MODEL_OPUS,
] as const;

export function supportsEffort(model: string): boolean {
  return AI_MODELS_WITHOUT_SAMPLING.includes(model);
}

/**
 * Modo degradado (TASK 3.9.2): quando o custo diário global estoura o limite,
 * a API liga `AI_DEGRADED` e tudo passa a rodar no Haiku até o reset.
 *
 * A flag é lida de `process.env` porque é o único canal que o pacote de IA
 * compartilha com a API sem inverter a dependência.
 */
export function isAiDegraded(): boolean {
  return process.env['AI_DEGRADED'] === 'true';
}

/** Resolve o modelo efetivo, rebaixando para Haiku em modo degradado. */
export function resolveEffectiveModel(requested: string): string {
  return isAiDegraded() ? AI_MODEL_HAIKU : requested;
}
