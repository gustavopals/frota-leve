import { aiClient } from '../client';
import { AI_MODEL_HAIKU } from '../models';
import {
  DRIVER_SCORING_TOOL,
  driverRecommendationSchema,
  type DriverRecommendation,
} from '../tools/driver-scoring.tool';

/** Pesos dos pilares — somam 100 (TASK 3.7.1). */
export const SCORE_WEIGHTS = {
  fuel: 25,
  fines: 25,
  incidents: 20,
  checklist: 15,
  vehicleCare: 15,
} as const;

/** Diferença mínima de pontos que justifica gastar token com recomendação. */
export const RECOMMENDATION_SCORE_DELTA = 5;

const RECOMMENDATION_MAX_TOKENS = 600;

export interface DriverScoreMetrics {
  /** km/l médio do motorista no período. */
  kmPerLiter: number | null;
  /** km/l médio da frota no mesmo período, usado como referência. */
  fleetAverageKmPerLiter: number | null;
  finesCount: number;
  finePoints: number;
  incidentsCount: number;
  /** Checklists entregues sobre checklists esperados. */
  checklistsCompleted: number;
  checklistsExpected: number;
  /** Manutenções corretivas atribuíveis ao período do motorista. */
  correctiveMaintenances: number;
  /** Veículos conduzidos — normaliza o pilar de cuidado. */
  vehiclesDriven: number;
}

export interface DriverScoreBreakdown {
  fuel: number;
  fines: number;
  incidents: number;
  checklist: number;
  vehicleCare: number;
}

export interface DriverScoreResult {
  score: number;
  breakdown: DriverScoreBreakdown;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Combustível: razão entre o km/l do motorista e a média da frota.
 *
 * Igual à média rende 70; cada 1% acima soma 3 pontos, cada 1% abaixo tira 3.
 * Sem dado de consumo o pilar fica neutro em 70, para não punir quem ainda não
 * tem histórico nem premiar quem não rodou.
 */
function scoreFuel(metrics: DriverScoreMetrics): number {
  if (
    !metrics.kmPerLiter ||
    !metrics.fleetAverageKmPerLiter ||
    metrics.fleetAverageKmPerLiter <= 0
  ) {
    return 70;
  }

  const ratio = metrics.kmPerLiter / metrics.fleetAverageKmPerLiter;

  return clamp(70 + (ratio - 1) * 300);
}

/**
 * Multas: 100 sem multa; cada multa custa 12 pontos e cada ponto na CNH, 3.
 * A dupla penalidade separa muitas multas leves de poucas multas graves.
 */
function scoreFines(metrics: DriverScoreMetrics): number {
  return clamp(100 - metrics.finesCount * 12 - metrics.finePoints * 3);
}

/** Sinistros: 100 sem ocorrência; cada sinistro custa 30 pontos. */
function scoreIncidents(metrics: DriverScoreMetrics): number {
  return clamp(100 - metrics.incidentsCount * 30);
}

/**
 * Checklist: aderência direta (entregues / esperados).
 * Sem checklist esperado no período o pilar fica neutro em 70.
 */
function scoreChecklist(metrics: DriverScoreMetrics): number {
  if (metrics.checklistsExpected <= 0) {
    return 70;
  }

  return clamp((metrics.checklistsCompleted / metrics.checklistsExpected) * 100);
}

/**
 * Cuidado com o veículo: manutenções corretivas por veículo conduzido.
 * Cada corretiva por veículo custa 25 pontos.
 */
function scoreVehicleCare(metrics: DriverScoreMetrics): number {
  const vehicles = Math.max(1, metrics.vehiclesDriven);

  return clamp(100 - (metrics.correctiveMaintenances / vehicles) * 25);
}

/**
 * Score determinístico do motorista (TASK 3.7.1).
 *
 * Função pura: mesmo input sempre produz o mesmo output, sem IA e sem I/O.
 * O total é a média ponderada dos cinco pilares, arredondada.
 */
export function computeDriverScore(metrics: DriverScoreMetrics): DriverScoreResult {
  const breakdown: DriverScoreBreakdown = {
    fuel: Math.round(scoreFuel(metrics)),
    fines: Math.round(scoreFines(metrics)),
    incidents: Math.round(scoreIncidents(metrics)),
    checklist: Math.round(scoreChecklist(metrics)),
    vehicleCare: Math.round(scoreVehicleCare(metrics)),
  };

  const weighted =
    breakdown.fuel * SCORE_WEIGHTS.fuel +
    breakdown.fines * SCORE_WEIGHTS.fines +
    breakdown.incidents * SCORE_WEIGHTS.incidents +
    breakdown.checklist * SCORE_WEIGHTS.checklist +
    breakdown.vehicleCare * SCORE_WEIGHTS.vehicleCare;

  return { score: Math.round(weighted / 100), breakdown };
}

/** Só vale gastar token quando o score se moveu o bastante (TASK 3.7.3). */
export function shouldGenerateRecommendation(
  currentScore: number,
  previousScore: number | null,
): boolean {
  if (previousScore === null) {
    return true;
  }

  return Math.abs(currentScore - previousScore) >= RECOMMENDATION_SCORE_DELTA;
}

export class ScoringService {
  compute(metrics: DriverScoreMetrics): DriverScoreResult {
    return computeDriverScore(metrics);
  }

  /**
   * Recomendações via Haiku com tool forçada (TASK 3.7.3).
   *
   * Devolve `null` em qualquer falha ou quando o schema não valida — assim o
   * chamador nunca persiste recomendação inválida, conforme o critério de aceite.
   */
  async recommend(params: {
    tenantId: string;
    userId?: string;
    driverName: string;
    result: DriverScoreResult;
    previousScore: number | null;
  }): Promise<DriverRecommendation | null> {
    if (process.env.AI_ENABLED !== 'true') {
      return null;
    }

    try {
      const response = await aiClient.invoke<unknown>({
        tenantId: params.tenantId,
        userId: params.userId,
        feature: 'scoring',
        model: AI_MODEL_HAIKU,
        system:
          'Voce orienta gestores de frota no Brasil sobre desempenho de motoristas. ' +
          'O score ja foi calculado por regras deterministicas: trate-o como fato. ' +
          'Responda somente chamando a ferramenta driverScoring, em portugues do Brasil.',
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              motorista: params.driverName,
              score: params.result.score,
              scoreAnterior: params.previousScore,
              pilares: params.result.breakdown,
              pesos: SCORE_WEIGHTS,
            }),
          },
        ],
        tools: [DRIVER_SCORING_TOOL],
        toolChoice: { type: 'tool', name: DRIVER_SCORING_TOOL.name },
        maxTokens: RECOMMENDATION_MAX_TOKENS,
      });

      const parsed = driverRecommendationSchema.safeParse(response.data);

      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }
}

export const scoringService = new ScoringService();
