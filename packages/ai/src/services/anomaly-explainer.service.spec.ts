import { AIAnomalyKind, AIAnomalySeverity } from '@frota-leve/database';
import { aiClient } from '../client';
import { AnomalyExplainerService } from './anomaly-explainer.service';
import type { AnomalyFinding } from './anomaly.types';

jest.mock('../client', () => ({
  aiClient: { invoke: jest.fn() },
}));

const invoke = aiClient.invoke as unknown as jest.Mock;

const FINDING: AnomalyFinding = {
  kind: AIAnomalyKind.FUEL_DEVIATION,
  severity: AIAnomalySeverity.HIGH,
  entityType: 'vehicle',
  entityId: 'veiculo-1',
  score: 3.2,
  evidence: { averageKmPerLiter: 10, sampleSize: 14 },
};

describe('AnomalyExplainerService.explain', () => {
  const originalAiEnabled = process.env.AI_ENABLED;
  let service: AnomalyExplainerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnomalyExplainerService();
    process.env.AI_ENABLED = 'true';
  });

  afterAll(() => {
    process.env.AI_ENABLED = originalAiEnabled;
  });

  it('devolve a mensagem produzida pela tool', async () => {
    invoke.mockResolvedValue({ data: { message: 'Consumo caiu; verifique o filtro de ar.' } });

    await expect(service.explain({ tenantId: 't1', finding: FINDING })).resolves.toBe(
      'Consumo caiu; verifique o filtro de ar.',
    );
  });

  it('força a tool explainAnomaly no modelo Haiku', async () => {
    invoke.mockResolvedValue({ data: { message: 'ok' } });

    await service.explain({ tenantId: 't1', finding: FINDING });

    expect(invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        feature: 'anomaly',
        model: 'claude-haiku-4-5-20251001',
        toolChoice: { type: 'tool', name: 'explainAnomaly' },
      }),
    );
  });

  it('não chama a IA quando AI_ENABLED não está ligado', async () => {
    process.env.AI_ENABLED = 'false';

    await expect(service.explain({ tenantId: 't1', finding: FINDING })).resolves.toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('devolve null quando a IA falha, em vez de propagar o erro', async () => {
    invoke.mockRejectedValue(new Error('quota estourada'));

    await expect(service.explain({ tenantId: 't1', finding: FINDING })).resolves.toBeNull();
  });

  it('devolve null quando a tool retorna algo fora do contrato', async () => {
    invoke.mockResolvedValue({ data: { message: 42 } });

    await expect(service.explain({ tenantId: 't1', finding: FINDING })).resolves.toBeNull();
  });

  it('trunca mensagens acima de 280 caracteres', async () => {
    invoke.mockResolvedValue({ data: { message: 'a'.repeat(400) } });

    const message = await service.explain({ tenantId: 't1', finding: FINDING });

    expect(message).toHaveLength(280);
    expect(message?.endsWith('…')).toBe(true);
  });
});
