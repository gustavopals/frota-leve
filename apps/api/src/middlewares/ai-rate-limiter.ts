import type { Request, Response, NextFunction } from 'express';
import { authCache } from '../modules/auth/auth.cache';
import { TooManyRequestsError, UnauthorizedError } from '../shared/errors';

/**
 * Limites por feature de IA (janela fixa via INCR + TTL no Redis).
 * Modelo simples e suficiente para evitar abuso por tenant.
 */
export type AIRateLimitFeature = 'chat' | 'ocr' | 'report-on-demand' | 'default';

const LIMITS: Record<AIRateLimitFeature, { max: number; windowSeconds: number }> = {
  chat: { max: 30, windowSeconds: 60 },
  ocr: { max: 10, windowSeconds: 60 },
  'report-on-demand': { max: 5, windowSeconds: 60 * 60 },
  default: { max: 60, windowSeconds: 60 },
};

/**
 * Factory de rate limiter por tenant + feature de IA.
 * Usa Redis (com fallback em memória) para contagem por janela.
 */
export function aiRateLimiter(feature: AIRateLimitFeature) {
  const config = LIMITS[feature];

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      next(new UnauthorizedError('Tenant não identificado'));
      return;
    }

    const key = `ai:rl:${feature}:${req.tenant.id}`;

    void authCache
      .increment(key, config.windowSeconds)
      .then((count) => {
        const remaining = Math.max(0, config.max - count);
        res.setHeader('X-RateLimit-Limit', String(config.max));
        res.setHeader('X-RateLimit-Remaining', String(remaining));
        res.setHeader('X-RateLimit-Window', String(config.windowSeconds));

        if (count > config.max) {
          next(
            new TooManyRequestsError(
              'Limite de requisições de IA excedido. Tente novamente em instantes.',
              { feature, max: config.max, windowSeconds: config.windowSeconds },
            ),
          );
          return;
        }

        next();
      })
      .catch(next);
  };
}
