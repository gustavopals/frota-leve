import { createClient } from 'redis';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

type CacheEntry = {
  value: string;
  expiresAt: number;
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

  increment(key: string, ttlSeconds: number): number {
    this.cleanupExpired(key);

    const existing = this.store.get(key);

    if (!existing) {
      this.set(key, '1', ttlSeconds);
      return 1;
    }

    const nextValue = String(Number(existing.value) + 1);

    this.store.set(key, {
      value: nextValue,
      expiresAt: existing.expiresAt,
    });

    return Number(nextValue);
  }

  clear(): void {
    this.store.clear();
  }
}

export class AuthCache {
  private readonly memoryStore = new MemoryTtlStore();
  private readonly redisClient = createClient({ url: env.REDIS_URL });
  private connectPromise: Promise<void> | null = null;
  private redisEnabled = env.NODE_ENV !== 'test';

  constructor() {
    this.redisClient.on('error', (error) => {
      logger.warn(
        'Falha no cliente Redis usado pelo módulo de autenticação. Usando fallback em memória.',
        {
          error: error.message,
        },
      );
    });
  }

  private async getRedisClient() {
    if (!this.redisEnabled) {
      return null;
    }

    if (this.redisClient.isOpen) {
      return this.redisClient;
    }

    if (!this.connectPromise) {
      this.connectPromise = this.redisClient
        .connect()
        .then(() => undefined)
        .catch((error: Error) => {
          this.redisEnabled = false;
          logger.warn(
            'Não foi possível conectar ao Redis da autenticação. Seguindo com fallback em memória.',
            {
              error: error.message,
            },
          );
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
      } catch (error) {
        logger.warn('Falha ao ler chave de autenticação no Redis. Usando fallback em memória.', {
          error: error instanceof Error ? error.message : String(error),
          key,
        });
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
      } catch (error) {
        logger.warn('Falha ao gravar chave de autenticação no Redis. Usando fallback em memória.', {
          error: error instanceof Error ? error.message : String(error),
          key,
        });
      }
    }

    this.memoryStore.set(key, value, ttlSeconds);
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const client = await this.getRedisClient();

    if (client) {
      try {
        const count = await client.incr(key);

        if (count === 1) {
          await client.expire(key, ttlSeconds);
        }

        return count;
      } catch (error) {
        logger.warn(
          'Falha ao incrementar chave de autenticação no Redis. Usando fallback em memória.',
          {
            error: error instanceof Error ? error.message : String(error),
            key,
          },
        );
      }
    }

    return this.memoryStore.increment(key, ttlSeconds);
  }

  clear(): void {
    this.memoryStore.clear();
  }
}

export const authCache = new AuthCache();
