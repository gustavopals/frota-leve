import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Registry próprio em vez do global (TASK 3.9.1).
 *
 * Isola as métricas da aplicação e evita colisão de nomes quando os testes
 * importam o módulo mais de uma vez no mesmo processo.
 */
export const aiMetricsRegistry = new Registry();

collectDefaultMetrics({ register: aiMetricsRegistry, prefix: 'frota_leve_' });

export const aiRequestsTotal = new Counter({
  name: 'ai_requests_total',
  help: 'Total de chamadas a modelos de IA.',
  labelNames: ['feature', 'model', 'status'] as const,
  registers: [aiMetricsRegistry],
});

export const aiTokensTotal = new Counter({
  name: 'ai_tokens_total',
  help: 'Total de tokens consumidos.',
  labelNames: ['direction', 'feature'] as const,
  registers: [aiMetricsRegistry],
});

export const aiCostUsdMicrosTotal = new Counter({
  name: 'ai_cost_usd_micros_total',
  help: 'Custo acumulado em micro-dólares.',
  labelNames: ['feature', 'model'] as const,
  registers: [aiMetricsRegistry],
});

export const aiLatencyMs = new Histogram({
  name: 'ai_latency_ms',
  help: 'Latência das chamadas de IA em milissegundos.',
  labelNames: ['feature', 'model'] as const,
  buckets: [100, 250, 500, 1000, 2000, 5000, 10_000, 30_000, 60_000],
  registers: [aiMetricsRegistry],
});

export const aiCacheHitsTotal = new Counter({
  name: 'ai_cache_hits_total',
  help: 'Respostas servidas do cache de IA.',
  labelNames: ['feature'] as const,
  registers: [aiMetricsRegistry],
});

export interface AiCallMetrics {
  feature: string;
  model: string;
  status: string;
  inputTokens: number;
  outputTokens: number;
  costUsdMicros: number;
  latencyMs: number;
  cacheHit?: boolean;
}

/** Registra uma chamada de IA em todas as séries de uma vez. */
export function recordAiCall(metrics: AiCallMetrics): void {
  const { feature, model, status } = metrics;

  aiRequestsTotal.inc({ feature, model, status });
  aiTokensTotal.inc({ direction: 'input', feature }, metrics.inputTokens);
  aiTokensTotal.inc({ direction: 'output', feature }, metrics.outputTokens);
  aiCostUsdMicrosTotal.inc({ feature, model }, metrics.costUsdMicros);
  aiLatencyMs.observe({ feature, model }, metrics.latencyMs);

  if (metrics.cacheHit) {
    aiCacheHitsTotal.inc({ feature });
  }
}
