import { AIAnomalyKind, AIAnomalySeverity } from '@frota-leve/database';
import {
  anomalyService,
  detectCostPerKmTrend,
  detectFinePattern,
  detectFuelDeviation,
  detectMaintenanceCost,
} from './anomaly.service';
import type { FineSample, FuelRecordSample, MaintenanceCostSample } from './anomaly.types';

const REFERENCE = new Date('2026-08-01T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(REFERENCE.getTime() - days * DAY_MS);
}

function fuelRecord(overrides: Partial<FuelRecordSample> & { id: string }): FuelRecordSample {
  return {
    vehicleId: 'veiculo-1',
    date: daysAgo(1),
    kmPerLiter: 10,
    ...overrides,
  };
}

/** Serie estavel de N abastecimentos em torno de 10 km/l, dentro da janela. */
function stableFuelSeries(count: number, vehicleId = 'veiculo-1'): FuelRecordSample[] {
  return Array.from({ length: count }, (_, index) =>
    fuelRecord({
      id: `${vehicleId}-abastecimento-${index}`,
      vehicleId,
      date: daysAgo(index + 1),
      // Alterna 9.9/10.1 para gerar dispersao pequena porem nao nula.
      kmPerLiter: index % 2 === 0 ? 9.9 : 10.1,
    }),
  );
}

describe('detectFuelDeviation', () => {
  it('nao acusa nada quando a amostra tem menos de 10 abastecimentos', () => {
    const records = [
      ...stableFuelSeries(8),
      fuelRecord({ id: 'outlier', date: daysAgo(2), kmPerLiter: 3 }),
    ];

    expect(detectFuelDeviation(records, REFERENCE)).toEqual([]);
  });

  it('nao acusa nada quando o consumo é estavel', () => {
    expect(detectFuelDeviation(stableFuelSeries(14), REFERENCE)).toEqual([]);
  });

  it('acusa desvio quando um abastecimento foge mais de 2 desvios padrao', () => {
    const records = [
      ...stableFuelSeries(14),
      fuelRecord({ id: 'abastecimento-suspeito', date: daysAgo(3), kmPerLiter: 4 }),
    ];

    const findings = detectFuelDeviation(records, REFERENCE);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      kind: AIAnomalyKind.FUEL_DEVIATION,
      entityType: 'vehicle',
      entityId: 'veiculo-1',
    });
    expect(findings[0]?.evidence).toMatchObject({ worstRecordId: 'abastecimento-suspeito' });
    expect(findings[0]?.score).toBeGreaterThan(2);
  });

  it('ignora abastecimentos fora da janela de 30 dias', () => {
    const records = [
      ...stableFuelSeries(14),
      fuelRecord({ id: 'antigo', date: daysAgo(45), kmPerLiter: 2 }),
    ];

    expect(detectFuelDeviation(records, REFERENCE)).toEqual([]);
  });

  it('ignora registros sem km/l calculado', () => {
    const records = [
      ...stableFuelSeries(14),
      fuelRecord({ id: 'sem-consumo', date: daysAgo(2), kmPerLiter: null }),
    ];

    expect(detectFuelDeviation(records, REFERENCE)).toEqual([]);
  });

  it('emite um unico achado por veiculo mesmo com varios outliers', () => {
    const records = [
      ...stableFuelSeries(20),
      fuelRecord({ id: 'outlier-a', date: daysAgo(2), kmPerLiter: 4 }),
      fuelRecord({ id: 'outlier-b', date: daysAgo(4), kmPerLiter: 4.2 }),
    ];

    const findings = detectFuelDeviation(records, REFERENCE);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.evidence).toMatchObject({
      outlierRecordIds: expect.arrayContaining(['outlier-a', 'outlier-b']),
    });
  });
});

describe('detectMaintenanceCost', () => {
  function peer(vehicleId: string, totalCost: number): MaintenanceCostSample {
    return { vehicleId, category: 'LIGHT', year: 2020, totalCost };
  }

  it('nao acusa nada quando o grupo de pares é pequeno demais', () => {
    const samples = [peer('v1', 100), peer('v2', 100), peer('v3', 100), peer('v4', 90_000)];

    expect(detectMaintenanceCost(samples)).toEqual([]);
  });

  it('acusa o veiculo acima do p90 do grupo', () => {
    const samples = [
      peer('v1', 1000),
      peer('v2', 1100),
      peer('v3', 1200),
      peer('v4', 1300),
      peer('v5', 1400),
      peer('v6', 9000),
    ];

    const findings = detectMaintenanceCost(samples);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      kind: AIAnomalyKind.MAINT_COST,
      entityId: 'v6',
      severity: AIAnomalySeverity.HIGH,
    });
  });

  it('nao acusa nada quando todos os pares gastam o mesmo', () => {
    const samples = Array.from({ length: 8 }, (_, index) => peer(`v${index}`, 1000));

    expect(detectMaintenanceCost(samples)).toEqual([]);
  });

  it('nao compara veiculos de categorias ou anos diferentes', () => {
    const samples: MaintenanceCostSample[] = [
      ...Array.from({ length: 5 }, (_, index) => peer(`leve-${index}`, 1000)),
      { vehicleId: 'pesado-1', category: 'HEAVY', year: 2020, totalCost: 50_000 },
      { vehicleId: 'leve-novo', category: 'LIGHT', year: 2024, totalCost: 50_000 },
    ];

    const findings = detectMaintenanceCost(samples);

    expect(findings.map((finding) => finding.entityId)).not.toContain('pesado-1');
    expect(findings.map((finding) => finding.entityId)).not.toContain('leve-novo');
  });
});

describe('detectFinePattern', () => {
  function fine(overrides: Partial<FineSample> & { id: string }): FineSample {
    return {
      vehicleId: 'veiculo-1',
      driverId: 'motorista-1',
      location: 'Av. Paulista, km 3',
      date: daysAgo(5),
      ...overrides,
    };
  }

  it('nao acusa nada com menos de 3 multas', () => {
    const fines = [fine({ id: 'm1' }), fine({ id: 'm2' })];

    expect(detectFinePattern(fines, REFERENCE)).toEqual([]);
  });

  it('acusa reincidencia do mesmo motorista', () => {
    const fines = [
      fine({ id: 'm1', location: 'Local A' }),
      fine({ id: 'm2', location: 'Local B' }),
      fine({ id: 'm3', location: 'Local C' }),
    ];

    const findings = detectFinePattern(fines, REFERENCE);
    const driverFinding = findings.find((finding) => finding.evidence['trigger'] === 'same_driver');

    expect(driverFinding).toMatchObject({
      kind: AIAnomalyKind.FINE_PATTERN,
      entityType: 'driver',
      entityId: 'motorista-1',
      score: 3,
    });
  });

  it('acusa reincidencia no mesmo local mesmo com motoristas diferentes', () => {
    const fines = [
      fine({ id: 'm1', driverId: 'motorista-1' }),
      fine({ id: 'm2', driverId: 'motorista-2' }),
      fine({ id: 'm3', driverId: 'motorista-3' }),
    ];

    const findings = detectFinePattern(fines, REFERENCE);
    const locationFinding = findings.find(
      (finding) => finding.evidence['trigger'] === 'same_location',
    );

    expect(locationFinding).toMatchObject({
      entityType: 'vehicle',
      entityId: 'veiculo-1',
      score: 3,
    });
    expect(findings.some((finding) => finding.evidence['trigger'] === 'same_driver')).toBe(false);
  });

  it('ignora multas fora da janela de 30 dias', () => {
    const fines = [
      fine({ id: 'm1', date: daysAgo(40) }),
      fine({ id: 'm2', date: daysAgo(50) }),
      fine({ id: 'm3', date: daysAgo(60) }),
    ];

    expect(detectFinePattern(fines, REFERENCE)).toEqual([]);
  });

  it('nao agrupa multas sem motorista no gatilho de motorista', () => {
    const fines = [
      fine({ id: 'm1', driverId: null, location: 'Local A' }),
      fine({ id: 'm2', driverId: null, location: 'Local B' }),
      fine({ id: 'm3', driverId: null, location: 'Local C' }),
    ];

    expect(detectFinePattern(fines, REFERENCE)).toEqual([]);
  });

  it('normaliza o local ao agrupar (caixa e espacos)', () => {
    const fines = [
      fine({ id: 'm1', driverId: null, location: 'Av. Paulista' }),
      fine({ id: 'm2', driverId: null, location: '  av. paulista  ' }),
      fine({ id: 'm3', driverId: null, location: 'AV. PAULISTA' }),
    ];

    const findings = detectFinePattern(fines, REFERENCE);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.score).toBe(3);
  });
});

describe('detectCostPerKmTrend', () => {
  it('nao acusa nada quando o custo/km é estavel', () => {
    const series = [
      {
        vehicleId: 'veiculo-1',
        points: [0, 1, 2, 3, 4, 5].map((monthIndex) => ({ monthIndex, costPerKm: 1 })),
      },
    ];

    expect(detectCostPerKmTrend(series)).toEqual([]);
  });

  it('acusa crescimento consistente acima de 5% ao mes', () => {
    const series = [
      {
        vehicleId: 'veiculo-1',
        points: [1, 1.1, 1.2, 1.3, 1.4, 1.5].map((costPerKm, monthIndex) => ({
          monthIndex,
          costPerKm,
        })),
      },
    ];

    const findings = detectCostPerKmTrend(series);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      kind: AIAnomalyKind.COST_PER_KM_TREND,
      entityType: 'vehicle',
      entityId: 'veiculo-1',
    });
    expect(findings[0]?.evidence['rSquared']).toBeGreaterThan(0.5);
  });

  it('nao acusa queda de custo', () => {
    const series = [
      {
        vehicleId: 'veiculo-1',
        points: [1.5, 1.4, 1.3, 1.2, 1.1, 1].map((costPerKm, monthIndex) => ({
          monthIndex,
          costPerKm,
        })),
      },
    ];

    expect(detectCostPerKmTrend(series)).toEqual([]);
  });

  it('nao acusa serie ruidosa sem ajuste (R² baixo)', () => {
    const series = [
      {
        vehicleId: 'veiculo-1',
        points: [1, 3, 0.5, 2.8, 0.7, 3.1].map((costPerKm, monthIndex) => ({
          monthIndex,
          costPerKm,
        })),
      },
    ];

    expect(detectCostPerKmTrend(series)).toEqual([]);
  });

  it('exige um minimo de meses na serie', () => {
    const series = [
      {
        vehicleId: 'veiculo-1',
        points: [1, 1.5, 2].map((costPerKm, monthIndex) => ({ monthIndex, costPerKm })),
      },
    ];

    expect(detectCostPerKmTrend(series)).toEqual([]);
  });
});

describe('AnomalyService.detect', () => {
  it('roda sem IA e devolve os achados das quatro regras', () => {
    const findings = anomalyService.detect({
      referenceDate: REFERENCE,
      fuelRecords: [
        ...stableFuelSeries(14),
        fuelRecord({ id: 'combustivel-outlier', date: daysAgo(2), kmPerLiter: 4 }),
      ],
      maintenanceCosts: [
        { vehicleId: 'v1', category: 'LIGHT', year: 2020, totalCost: 1000 },
        { vehicleId: 'v2', category: 'LIGHT', year: 2020, totalCost: 1100 },
        { vehicleId: 'v3', category: 'LIGHT', year: 2020, totalCost: 1200 },
        { vehicleId: 'v4', category: 'LIGHT', year: 2020, totalCost: 1300 },
        { vehicleId: 'v5', category: 'LIGHT', year: 2020, totalCost: 1400 },
        { vehicleId: 'v6', category: 'LIGHT', year: 2020, totalCost: 9000 },
      ],
      fines: [
        {
          id: 'm1',
          vehicleId: 'veiculo-9',
          driverId: 'motorista-9',
          location: 'A',
          date: daysAgo(2),
        },
        {
          id: 'm2',
          vehicleId: 'veiculo-9',
          driverId: 'motorista-9',
          location: 'B',
          date: daysAgo(3),
        },
        {
          id: 'm3',
          vehicleId: 'veiculo-9',
          driverId: 'motorista-9',
          location: 'C',
          date: daysAgo(4),
        },
      ],
      costPerKmSeries: [
        {
          vehicleId: 'veiculo-tendencia',
          points: [1, 1.1, 1.2, 1.3, 1.4, 1.5].map((costPerKm, monthIndex) => ({
            monthIndex,
            costPerKm,
          })),
        },
      ],
    });

    const kinds = findings.map((finding) => finding.kind);

    expect(kinds).toContain(AIAnomalyKind.FUEL_DEVIATION);
    expect(kinds).toContain(AIAnomalyKind.MAINT_COST);
    expect(kinds).toContain(AIAnomalyKind.FINE_PATTERN);
    expect(kinds).toContain(AIAnomalyKind.COST_PER_KM_TREND);
  });

  it('devolve lista vazia quando nao ha dados', () => {
    const findings = anomalyService.detect({
      referenceDate: REFERENCE,
      fuelRecords: [],
      maintenanceCosts: [],
      fines: [],
      costPerKmSeries: [],
    });

    expect(findings).toEqual([]);
  });
});
