import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../shared/errors/app-error';

/**
 * Middleware de autenticação JWT.
 * Verifica o Bearer token no header Authorization e popula req.user.
 *
 * TODO TASK 1.1 — implementar verificação JWT completa:
 *   - Extrair Bearer token
 *   - Verificar assinatura e expiração (jsonwebtoken)
 *   - Buscar user no banco ou cache Redis
 *   - Setar req.user com { id, tenantId, role, email }
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Token de autenticação não fornecido'));
    return;
  }

  // Placeholder — implementação real na TASK 1.1
  next();
}

/**
 * Factory de middleware de autorização por role.
 * Verifica se req.user.role está na lista de roles permitidos.
 *
 * TODO TASK 1.1 — implementar após autenticação estar pronta
 */
export function authorize(..._roles: string[]) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    // Placeholder — implementação real na TASK 1.1
    next();
  };
}
