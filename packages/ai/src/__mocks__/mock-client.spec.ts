import path from 'node:path';
import { MockAnthropicClient } from './mock-client';

describe('MockAnthropicClient', () => {
  const originalFixture = process.env.AI_MOCK_FIXTURE;
  const originalFailure = process.env.AI_MOCK_FAILURE;

  afterEach(() => {
    process.env.AI_MOCK_FIXTURE = originalFixture;
    process.env.AI_MOCK_FAILURE = originalFailure;
  });

  it('loads the default fixture for a feature', async () => {
    const client = new MockAnthropicClient(path.resolve(__dirname, 'fixtures'));

    const result = await client.invoke<string>({
      tenantId: 'tenant-id',
      feature: 'chat',
      model: 'claude-haiku-4-5-20251001',
      system: 'system',
      messages: [{ role: 'user', content: 'oi' }],
      maxTokens: 200,
    });

    expect(result.data).toBe('Resumo mockado da frota.');
    expect(result.providerMessageId).toBe('mock-chat-001');
    expect(result.usage?.inputTokens).toBe(120);
  });

  it('supports fixture override by environment variable', async () => {
    process.env.AI_MOCK_FIXTURE = 'scoring.success.json';
    const client = new MockAnthropicClient(path.resolve(__dirname, 'fixtures'));

    const result = await client.invoke<{ score: number }>({
      tenantId: 'tenant-id',
      feature: 'chat',
      model: 'claude-haiku-4-5-20251001',
      system: 'system',
      messages: [{ role: 'user', content: 'oi' }],
      maxTokens: 200,
    });

    expect(result.data.score).toBe(84);
  });

  it('can simulate provider failure through environment variable', async () => {
    process.env.AI_MOCK_FAILURE = 'true';
    const client = new MockAnthropicClient(path.resolve(__dirname, 'fixtures'));

    await expect(
      client.invoke({
        tenantId: 'tenant-id',
        feature: 'chat',
        model: 'claude-haiku-4-5-20251001',
        system: 'system',
        messages: [{ role: 'user', content: 'oi' }],
        maxTokens: 200,
      }),
    ).rejects.toThrow('Falha simulada do MockAnthropicClient.');
  });
});
