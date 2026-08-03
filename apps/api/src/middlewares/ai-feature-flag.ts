import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { AIDisabledError } from '../shared/errors';

/**
 * Feature flag global de IA.
 * Quando `AI_ENABLED=false`, todas as rotas de IA respondem 503 com `AI_DISABLED`.
 * Deve ser o primeiro middleware no router de IA.
 */
export function aiFeatureFlag(_req: Request, _res: Response, next: NextFunction): void {
  if (!env.AI_ENABLED) {
    next(new AIDisabledError());
    return;
  }

  next();
}
