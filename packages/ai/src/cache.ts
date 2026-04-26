import { createHash } from 'node:crypto';
import { createClient, type RedisClientType } from 'redis';
import type { AiClientInvokeParams, AiPromptBlock } from './types';

type CacheEntry = {
  value: string;
  expiresAt: number;
};

type AiCachePayload = {
  model: string;
  system: string;
  messages: AiPromptBlock[];
  tools?: AiClientInvokeParams['tools'];
};

class MemoryTtlStore {
  private readonly store = new Map<string, CacheEntry>();

  private cleanupExpired(key: string): void {
    const entry = this.store.get(key);

    if (entry && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
    }
  }

  get(key: string): string | null {
    this.cleanupExpired(key);
    return this.store.get(key)?.value ?? null;
  }

  set(key: string, value: string, ttlSeconds: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  clear(): void {
    this.store.clear();
  }
}

export const AI_CACHE_TTL_SECONDS: Record<AiClientInvokeParams['feature'], number> = {
  chat: 5 * 60,
  analysis: 5 * 60,
  report: 24 * 60 * 60,
  ocr: 60 * 60,
  anomaly: 5 * 60,
  scoring: 24 * 60 * 60,
};

export class AiCache {
  private readonly memoryStore = new MemoryTtlStore();
  private readonly redisClient: RedisClientType | null;
  private connectPromise: Promise<void> | null = null;
  private redisEnabled: boolean;

  constructor() {
    const redisUrl = process.env.REDIS_URL;

    this.redisEnabled = Boolean(redisUrl) && process.env.NODE_ENV !== 'test';
    this.redisClient = redisUrl ? createClient({ url: redisUrl }) : null;

    this.redisClient?.on('error', () => {
      this.redisEnabled = false;
    });
  }

  private async getRedisClient(): Promise<RedisClientType | null> {
    if (!this.redisEnabled || !this.redisClient) {
      return null;
    }

    if (this.redisClient.isOpen) {
      return this.redisClient;
    }

    if (!this.connectPromise) {
      this.connectPromise = this.redisClient
        .connect()
        .then(() => undefined)
        .catch(() => {
          this.redisEnabled = false;
        })
        .finally(() => {
          this.connectPromise = null;
        });
    }

    await this.connectPromise;

    return this.redisEnabled && this.redisClient.isOpen ? this.redisClient : null;
  }

  async get(key: string): Promise<string | null> {
    const client = await this.getRedisClient();

    if (client) {
      try {
        return await client.get(key);
      } catch {
        this.redisEnabled = false;
      }
    }

    return this.memoryStore.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const client = await this.getRedisClient();

    if (client) {
      try {
        await client.set(key, value, { EX: ttlSeconds });
        return;
      } catch {
        this.redisEnabled = false;
      }
    }

    this.memoryStore.set(key, value, ttlSeconds);
  }

  clear(): void {
    this.memoryStore.clear();
  }
}

function serializeCachePayload(payload: AiCachePayload): string {
  return JSON.stringify({
    model: payload.model,
    system: payload.system,
    messages: payload.messages.map((message) => ({
      role: message.role,
      content: message.content,
      cacheable: message.cacheable ?? false,
      containsFreshImage: message.containsFreshImage ?? false,
    })),
    tools: payload.tools?.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  });
}

export function getAiCacheTtlSeconds(feature: AiClientInvokeParams['feature']): number {
  return AI_CACHE_TTL_SECONDS[feature];
}

export function shouldCacheAiResponse(messages: AiPromptBlock[]): boolean {
  return messages.every((message) => message.containsFreshImage !== true);
}

export function buildAiCacheKey(
  feature: AiClientInvokeParams['feature'],
  payload: AiCachePayload,
): string {
  const digest = createHash('sha256').update(serializeCachePayload(payload)).digest('hex');
  return `ai:cache:${feature}:${digest}`;
}

const aiCache = new AiCache();

export async function getCachedAiResponse(key: string): Promise<string | null> {
  return aiCache.get(key);
}

export async function setCachedAiResponse(
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> {
  await aiCache.set(key, value, ttlSeconds);
}
