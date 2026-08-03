import {
  AIConfigurationError,
  AIModelNotAllowedError,
  AIPlanRequiredError,
  AIProviderError,
  AIQuotaExceededError,
  AiError,
  AiNotImplementedError,
} from './errors';
import { AI_MODEL_HAIKU, isAiDegraded, resolveEffectiveModel } from './models';

describe('hierarquia de erros de IA', () => {
  const cases = [
    new AiNotImplementedError('Serviço.metodo'),
    new AIConfigurationError('sem chave'),
    new AIPlanRequiredError('tenant-1'),
    new AIModelNotAllowedError('claude-opus-5'),
    new AIQuotaExceededError('tenant-1'),
    new AIProviderError('falha upstream'),
  ];

  it.each(cases)('$name estende AiError e Error', (error) => {
    expect(error).toBeInstanceOf(AiError);
    expect(error).toBeInstanceOf(Error);
  });

  it.each(cases)('$name expõe name próprio para mapear código', (error) => {
    expect(error.name).toBe(error.constructor.name);
  });

  it.each(cases)('$name tem mensagem não vazia', (error) => {
    expect(error.message.length).toBeGreaterThan(0);
  });

  it('cita o modelo recusado', () => {
    expect(new AIModelNotAllowedError('claude-opus-5').message).toContain('claude-opus-5');
  });
});

describe('modo degradado', () => {
  const original = process.env['AI_DEGRADED'];

  afterEach(() => {
    process.env['AI_DEGRADED'] = original;
  });

  it('mantém o modelo pedido em operação normal', () => {
    process.env['AI_DEGRADED'] = 'false';

    expect(isAiDegraded()).toBe(false);
    expect(resolveEffectiveModel('claude-sonnet-5')).toBe('claude-sonnet-5');
  });

  it('rebaixa tudo para Haiku em modo degradado', () => {
    process.env['AI_DEGRADED'] = 'true';

    expect(isAiDegraded()).toBe(true);
    expect(resolveEffectiveModel('claude-opus-5')).toBe(AI_MODEL_HAIKU);
    expect(resolveEffectiveModel('claude-sonnet-5')).toBe(AI_MODEL_HAIKU);
  });

  it('trata ausência da variável como operação normal', () => {
    delete process.env['AI_DEGRADED'];

    expect(isAiDegraded()).toBe(false);
  });
});
