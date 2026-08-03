import { AI_MODEL_HAIKU, AI_MODEL_OPUS, AI_MODEL_SONNET } from './models';
import { AI_MODEL_PRICING_TABLE, computeCostUsdMicros, getModelPricing } from './pricing';

describe('getModelPricing', () => {
  it('conhece os três modelos suportados', () => {
    for (const model of [AI_MODEL_HAIKU, AI_MODEL_SONNET, AI_MODEL_OPUS]) {
      expect(getModelPricing(model)).not.toBeNull();
    }
  });

  it('devolve null para modelo desconhecido', () => {
    expect(getModelPricing('claude-inexistente')).toBeNull();
  });

  it('mantém a ordem de preço entre os tiers', () => {
    const haiku = AI_MODEL_PRICING_TABLE[AI_MODEL_HAIKU];
    const sonnet = AI_MODEL_PRICING_TABLE[AI_MODEL_SONNET];
    const opus = AI_MODEL_PRICING_TABLE[AI_MODEL_OPUS];

    expect(haiku?.inputUsdPerMillion).toBeLessThan(sonnet?.inputUsdPerMillion ?? 0);
    expect(sonnet?.inputUsdPerMillion).toBeLessThan(opus?.inputUsdPerMillion ?? 0);
  });

  it('cobra leitura de cache a 10% do input', () => {
    for (const pricing of Object.values(AI_MODEL_PRICING_TABLE)) {
      expect(pricing.cacheReadUsdPerMillion).toBeCloseTo(pricing.inputUsdPerMillion * 0.1, 5);
    }
  });

  it('cobra escrita de cache a 125% do input', () => {
    for (const pricing of Object.values(AI_MODEL_PRICING_TABLE)) {
      expect(pricing.cacheCreationUsdPerMillion).toBeCloseTo(pricing.inputUsdPerMillion * 1.25, 5);
    }
  });
});

describe('computeCostUsdMicros', () => {
  it('calcula o custo somando as quatro dimensões', () => {
    // Sonnet: 3 USD/M input, 15 USD/M output.
    const cost = computeCostUsdMicros(
      { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      AI_MODEL_SONNET,
    );

    expect(cost).toBe(18 * 1_000_000);
  });

  it('considera tokens de cache', () => {
    const cost = computeCostUsdMicros(
      { cacheReadTokens: 1_000_000, cacheCreationTokens: 1_000_000 },
      AI_MODEL_SONNET,
    );

    // 0.3 + 3.75 = 4.05 USD
    expect(cost).toBe(4_050_000);
  });

  it('devolve zero para modelo sem preço cadastrado', () => {
    expect(computeCostUsdMicros({ inputTokens: 1_000_000 }, 'desconhecido')).toBe(0);
  });

  it('devolve zero sem consumo', () => {
    expect(computeCostUsdMicros({}, AI_MODEL_SONNET)).toBe(0);
  });
});
