import { aiClient } from '../client';
import { AI_MODEL_HAIKU } from '../models';
import { ANOMALY_MESSAGE_MAX_CHARS, ANOMALY_TOOL } from '../tools/anomaly.tool';
import type { AnomalyFinding } from './anomaly.types';

const EXPLAIN_MAX_TOKENS = 300;

const KIND_CONTEXT: Record<string, string> = {
  FUEL_DEVIATION:
    'Abastecimentos com km/l fora de 2 desvios padrao da media do proprio veiculo nos ultimos 30 dias.',
  MAINT_COST:
    'Custo de manutencao nos ultimos 90 dias acima do percentil 90 dos veiculos de mesma categoria e ano.',
  FINE_PATTERN: 'Reincidencia de multas do mesmo motorista ou do mesmo veiculo no mesmo local.',
  COST_PER_KM_TREND: 'Custo por km em tendencia de alta consistente nos ultimos meses.',
};

const SYSTEM_PROMPT = [
  'Voce apoia gestores de frota no Brasil.',
  'Uma anomalia JA foi detectada por regras deterministicas: trate-a como fato dado.',
  'Sua unica tarefa e escrever a explicacao chamando a ferramenta explainAnomaly.',
  `A mensagem deve ter no maximo ${ANOMALY_MESSAGE_MAX_CHARS} caracteres, em portugues do Brasil,`,
  'com a causa provavel e uma recomendacao pratica. Seja direto, sem saudacao.',
].join(' ');

function buildUserPrompt(finding: AnomalyFinding): string {
  const context = KIND_CONTEXT[finding.kind] ?? 'Anomalia operacional de frota.';

  return [
    `Tipo: ${finding.kind}`,
    `Regra: ${context}`,
    `Severidade: ${finding.severity}`,
    `Entidade: ${finding.entityType}`,
    `Evidencias: ${JSON.stringify(finding.evidence)}`,
  ].join('\n');
}

function extractMessage(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const message = (data as Record<string, unknown>)['message'];

  if (typeof message !== 'string') {
    return null;
  }

  const trimmed = message.trim();

  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.length > ANOMALY_MESSAGE_MAX_CHARS
    ? `${trimmed.slice(0, ANOMALY_MESSAGE_MAX_CHARS - 1)}…`
    : trimmed;
}

export class AnomalyExplainerService {
  /**
   * Gera a explicação da anomalia com Haiku, forçando a tool `explainAnomaly`.
   *
   * Retorna `null` — nunca lança — quando a IA está desligada, sem chave, sem
   * quota, fora do plano ou devolve algo inválido. O chamador cai no texto
   * determinístico, mantendo o critério de aceite da TASK 3.4: a detecção
   * funciona sem `AI_ENABLED`, e só o texto depende da IA.
   */
  async explain(params: {
    tenantId: string;
    userId?: string;
    finding: AnomalyFinding;
  }): Promise<string | null> {
    if (process.env.AI_ENABLED !== 'true') {
      return null;
    }

    try {
      const result = await aiClient.invoke<unknown>({
        tenantId: params.tenantId,
        userId: params.userId,
        feature: 'anomaly',
        model: AI_MODEL_HAIKU,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(params.finding) }],
        tools: [ANOMALY_TOOL],
        toolChoice: { type: 'tool', name: ANOMALY_TOOL.name },
        maxTokens: EXPLAIN_MAX_TOKENS,
      });

      return extractMessage(result.data);
    } catch {
      return null;
    }
  }
}

export const anomalyExplainerService = new AnomalyExplainerService();
