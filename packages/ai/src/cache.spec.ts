import {
  AI_CACHE_TTL_SECONDS,
  buildAiCacheKey,
  getAiCacheTtlSeconds,
  getCachedAiResponse,
  setCachedAiResponse,
  shouldCacheAiResponse,
} from './cache';
import type { AiPromptBlock } from './types';

describe('getAiCacheTtlSeconds', () => {
  it('devolve o TTL configurado por feature', () => {
    expect(getAiCacheTtlSeconds('chat')).toBe(AI_CACHE_TTL_SECONDS.chat);
    expect(getAiCacheTtlSeconds('report')).toBe(24 * 60 * 60);
  });

  it('dá TTL longo para saídas caras e estáveis', () => {
    expect(getAiCacheTtlSeconds('report')).toBeGreaterThan(getAiCacheTtlSeconds('chat'));
    expect(getAiCacheTtlSeconds('scoring')).toBeGreaterThan(getAiCacheTtlSeconds('anomaly'));
  });
});

describe('shouldCacheAiResponse', () => {
  it('permite cache para mensagens comuns', () => {
    const messages: AiPromptBlock[] = [{ role: 'user', content: 'Qual o custo do mês?' }];

    expect(shouldCacheAiResponse(messages)).toBe(true);
  });

  it('bloqueia cache quando há imagem nova no prompt', () => {
    const messages: AiPromptBlock[] = [
      { role: 'user', content: 'Leia este cupom', containsFreshImage: true },
    ];

    expect(shouldCacheAiResponse(messages)).toBe(false);
  });
});

describe('buildAiCacheKey', () => {
  const payload = {
    model: 'claude-sonnet-5',
    system: 'prompt',
    messages: [{ role: 'user' as const, content: 'pergunta' }],
  };

  it('é determinística para o mesmo payload', () => {
    expect(buildAiCacheKey('chat', payload)).toBe(buildAiCacheKey('chat', payload));
  });

  it('muda quando o modelo muda', () => {
    expect(buildAiCacheKey('chat', payload)).not.toBe(
      buildAiCacheKey('chat', { ...payload, model: 'claude-haiku-4-5-20251001' }),
    );
  });

  it('muda quando a mensagem muda', () => {
    expect(buildAiCacheKey('chat', payload)).not.toBe(
      buildAiCacheKey('chat', {
        ...payload,
        messages: [{ role: 'user', content: 'outra pergunta' }],
      }),
    );
  });

  it('separa features diferentes', () => {
    expect(buildAiCacheKey('chat', payload)).not.toBe(buildAiCacheKey('report', payload));
  });
});

describe('cache em memória (sem Redis)', () => {
  it('devolve null para chave inexistente', async () => {
    await expect(getCachedAiResponse('chave-que-nao-existe')).resolves.toBeNull();
  });

  it('grava e lê o valor', async () => {
    const key = buildAiCacheKey('chat', {
      model: 'm',
      system: 's',
      messages: [{ role: 'user', content: 'grava-e-le' }],
    });

    await setCachedAiResponse(key, '{"ok":true}', 60);

    await expect(getCachedAiResponse(key)).resolves.toBe('{"ok":true}');
  });

  it('expira o valor após o TTL', async () => {
    const key = buildAiCacheKey('chat', {
      model: 'm',
      system: 's',
      messages: [{ role: 'user', content: 'expira' }],
    });

    await setCachedAiResponse(key, 'valor', 0);
    await new Promise((resolve) => setTimeout(resolve, 5));

    await expect(getCachedAiResponse(key)).resolves.toBeNull();
  });
});
