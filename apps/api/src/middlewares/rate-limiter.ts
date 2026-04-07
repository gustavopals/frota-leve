import type { Request, Response, NextFunction } from 'express';

/**
 * Rate limiting por IP.
 * Implementação completa com Redis na TASK 0.3 (após setup do Redis):
 *   - express-rate-limit com rate-limit-redis store
 *   - Limites configuráveis por plano e por endpoint
 *   - Ex: 5 tentativas de login/min por IP, 100 req/min geral por tenant
 */
export function rateLimiter(_req: Request, _res: Response, next: NextFunction): void {
  // Placeholder — implementação real na TASK 0.3
  next();
}
