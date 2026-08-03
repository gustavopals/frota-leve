import { aiClient } from '../client';
import { computeDriverBadges } from './driver-badges';
import {
  SCORE_WEIGHTS,
  ScoringService,
  computeDriverScore,
  shouldGenerateRecommendation,
  type DriverScoreMetrics,
} from './scoring.service';

jest.mock('../client', () => ({ aiClient: { invoke: jest.fn() } }));

const invoke = aiClient.invoke as unknown as jest.Mock;

function metrics(overrides: Partial<DriverScoreMetrics> = {}): DriverScoreMetrics {
  return {
    kmPerLiter: 10,
    fleetAverageKmPerLiter: 10,
    finesCount: 0,
    finePoints: 0,
    incidentsCount: 0,
    checklistsCompleted: 10,
    checklistsExpected: 10,
    correctiveMaintenances: 0,
    vehiclesDriven: 1,
    ...overrides,
  };
}

describe('computeDriverScore', () => {
  it('é determinístico: mesmo input, mesmo output', () => {
    const input = metrics({ finesCount: 2, incidentsCount: 1 });

    expect(computeDriverScore(input)).toEqual(computeDriverScore(input));
  });

  it('os pesos somam 100', () => {
    const total = Object.values(SCORE_WEIGHTS).reduce((sum, weight) => sum + weight, 0);

    expect(total).toBe(100);
  });

  it('dá nota máxima ao motorista impecável acima da média de consumo', () => {
    const result = computeDriverScore(metrics({ kmPerLiter: 14, fleetAverageKmPerLiter: 10 }));

    expect(result.breakdown.fuel).toBe(100);
    expect(result.breakdown.fines).toBe(100);
    expect(result.breakdown.incidents).toBe(100);
    expect(result.breakdown.checklist).toBe(100);
    expect(result.breakdown.vehicleCare).toBe(100);
    expect(result.score).toBe(100);
  });

  it('mantém o pilar de combustível em 70 quando não há dado de consumo', () => {
    expect(computeDriverScore(metrics({ kmPerLiter: null })).breakdown.fuel).toBe(70);
    expect(computeDriverScore(metrics({ fleetAverageKmPerLiter: null })).breakdown.fuel).toBe(70);
  });

  it('pontua o consumo na média em 70', () => {
    expect(computeDriverScore(metrics()).breakdown.fuel).toBe(70);
  });

  it('penaliza consumo abaixo da média', () => {
    const result = computeDriverScore(metrics({ kmPerLiter: 8, fleetAverageKmPerLiter: 10 }));

    expect(result.breakdown.fuel).toBe(10);
  });

  it('penaliza multas por quantidade e por pontos na CNH', () => {
    expect(computeDriverScore(metrics({ finesCount: 1, finePoints: 0 })).breakdown.fines).toBe(88);
    expect(computeDriverScore(metrics({ finesCount: 1, finePoints: 5 })).breakdown.fines).toBe(73);
  });

  it('nunca deixa um pilar sair da faixa 0-100', () => {
    const terrible = computeDriverScore(
      metrics({
        kmPerLiter: 1,
        fleetAverageKmPerLiter: 10,
        finesCount: 20,
        finePoints: 60,
        incidentsCount: 10,
        checklistsCompleted: 0,
        correctiveMaintenances: 50,
      }),
    );

    for (const value of Object.values(terrible.breakdown)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
    expect(terrible.score).toBeGreaterThanOrEqual(0);
  });

  it('mantém checklist neutro quando nada era esperado', () => {
    expect(computeDriverScore(metrics({ checklistsExpected: 0 })).breakdown.checklist).toBe(70);
  });

  it('normaliza corretivas pelo número de veículos conduzidos', () => {
    const oneVehicle = computeDriverScore(
      metrics({ correctiveMaintenances: 2, vehiclesDriven: 1 }),
    );
    const fourVehicles = computeDriverScore(
      metrics({ correctiveMaintenances: 2, vehiclesDriven: 4 }),
    );

    expect(fourVehicles.breakdown.vehicleCare).toBeGreaterThan(oneVehicle.breakdown.vehicleCare);
  });
});

describe('shouldGenerateRecommendation', () => {
  it('gera na primeira avaliação', () => {
    expect(shouldGenerateRecommendation(80, null)).toBe(true);
  });

  it('não gera para variação menor que 5 pontos', () => {
    expect(shouldGenerateRecommendation(80, 84)).toBe(false);
    expect(shouldGenerateRecommendation(80, 76)).toBe(false);
  });

  it('gera para variação de 5 pontos ou mais, em qualquer direção', () => {
    expect(shouldGenerateRecommendation(80, 75)).toBe(true);
    expect(shouldGenerateRecommendation(70, 90)).toBe(true);
  });
});

describe('ScoringService.recommend', () => {
  const originalAiEnabled = process.env.AI_ENABLED;
  let service: ScoringService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ScoringService();
    process.env.AI_ENABLED = 'true';
  });

  afterAll(() => {
    process.env.AI_ENABLED = originalAiEnabled;
  });

  const result = computeDriverScore(metrics());

  it('devolve as recomendações validadas', async () => {
    invoke.mockResolvedValue({
      data: {
        strengths: ['Consumo acima da média'],
        improvements: ['Entregar checklist no prazo'],
        actions: [{ kind: 'TRAINING', description: 'Direção defensiva' }],
      },
    });

    await expect(
      service.recommend({ tenantId: 't1', driverName: 'Ana', result, previousScore: 70 }),
    ).resolves.toMatchObject({ actions: [{ kind: 'TRAINING' }] });
  });

  it('devolve null quando a tool responde fora do schema', async () => {
    invoke.mockResolvedValue({
      data: { strengths: 'texto', improvements: [], actions: [{ kind: 'OUTRO' }] },
    });

    await expect(
      service.recommend({ tenantId: 't1', driverName: 'Ana', result, previousScore: 70 }),
    ).resolves.toBeNull();
  });

  it('devolve null sem AI_ENABLED e não chama a IA', async () => {
    process.env.AI_ENABLED = 'false';

    await expect(
      service.recommend({ tenantId: 't1', driverName: 'Ana', result, previousScore: 70 }),
    ).resolves.toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('devolve null quando a IA falha', async () => {
    invoke.mockRejectedValue(new Error('timeout'));

    await expect(
      service.recommend({ tenantId: 't1', driverName: 'Ana', result, previousScore: 70 }),
    ).resolves.toBeNull();
  });
});

describe('computeDriverBadges', () => {
  it('concede Econômico com 3 meses seguidos no top 20%', () => {
    const badges = computeDriverBadges({
      fuelPercentileByMonth: [92, 85, 81, 40],
      finesInLast90Days: 3,
      checklistsCompletedLast30Days: 1,
      checklistsExpectedLast30Days: 4,
    });

    expect(badges.map((badge) => badge.code)).toEqual(['ECONOMICO']);
  });

  it('não concede Econômico com histórico incompleto', () => {
    const badges = computeDriverBadges({
      fuelPercentileByMonth: [95, 92],
      finesInLast90Days: 1,
      checklistsCompletedLast30Days: 0,
      checklistsExpectedLast30Days: 2,
    });

    expect(badges).toEqual([]);
  });

  it('concede Zero Multas e Checklist em dia', () => {
    const badges = computeDriverBadges({
      fuelPercentileByMonth: [50],
      finesInLast90Days: 0,
      checklistsCompletedLast30Days: 4,
      checklistsExpectedLast30Days: 4,
    });

    expect(badges.map((badge) => badge.code)).toEqual(['ZERO_MULTAS_90D', 'CHECKLIST_EM_DIA_30D']);
  });

  it('não concede badge de checklist quando nada era esperado', () => {
    const badges = computeDriverBadges({
      fuelPercentileByMonth: [],
      finesInLast90Days: 0,
      checklistsCompletedLast30Days: 0,
      checklistsExpectedLast30Days: 0,
    });

    expect(badges.map((badge) => badge.code)).toEqual(['ZERO_MULTAS_90D']);
  });
});
