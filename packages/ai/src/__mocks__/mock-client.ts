import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { AIProviderError } from '../errors';
import type { AiClientInvokeParams, AiClientInvokeResult, AiUsageMetrics } from '../types';

type MockFixture = {
  providerMessageId?: string;
  stopReason?: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | 'pause_turn' | 'refusal';
  rawText?: string;
  data: unknown;
  usage?: AiUsageMetrics;
};

const DEFAULT_FIXTURE_BY_FEATURE: Record<AiClientInvokeParams['feature'], string> = {
  chat: 'chat.success.json',
  analysis: 'analysis.success.json',
  report: 'report.success.json',
  ocr: 'ocr.success.json',
  anomaly: 'anomaly.success.json',
  scoring: 'scoring.success.json',
};

export class MockAnthropicClient {
  private readonly fixturesDir: string;

  constructor(fixturesDir = path.resolve(__dirname, 'fixtures')) {
    this.fixturesDir = fixturesDir;
  }

  private resolveFixtureName(params: AiClientInvokeParams): string {
    const overriddenFixture = process.env.AI_MOCK_FIXTURE;

    if (overriddenFixture) {
      return overriddenFixture;
    }

    return DEFAULT_FIXTURE_BY_FEATURE[params.feature];
  }

  private async loadFixture(params: AiClientInvokeParams): Promise<MockFixture> {
    const fixtureName = this.resolveFixtureName(params);
    const fixturePath = path.join(this.fixturesDir, fixtureName);

    try {
      const fixtureContent = await readFile(fixturePath, 'utf8');
      return JSON.parse(fixtureContent) as MockFixture;
    } catch (error) {
      throw new AIProviderError(
        `Nao foi possivel carregar o fixture mock ${fixtureName}.`,
        'AI_MOCK_FIXTURE_ERROR',
        error,
      );
    }
  }

  async invoke<T>(params: AiClientInvokeParams): Promise<AiClientInvokeResult<T>> {
    if (process.env.AI_MOCK_FAILURE === 'true') {
      throw new AIProviderError('Falha simulada do MockAnthropicClient.', 'AI_MOCK_FORCED_ERROR');
    }

    const fixture = await this.loadFixture(params);

    return {
      data: fixture.data as T,
      usage: fixture.usage ?? {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        latencyMs: 0,
      },
      providerMessageId: fixture.providerMessageId ?? `mock-${params.feature}`,
      stopReason: fixture.stopReason ?? 'end_turn',
      rawText: fixture.rawText,
      cacheHit: false,
    };
  }
}
