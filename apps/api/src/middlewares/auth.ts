import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@frota-leve/database';
import { authService } from '../modules/auth/auth.service';
import { ForbiddenError, UnauthorizedError } from '../shared/errors/app-error';

/**
 * Middleware de autenticação JWT.
 * Verifica o Bearer token no header Authorization e popula req.user.
 *
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Token de autenticação não fornecido'));
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  if (!token) {
    next(new UnauthorizedError('Token de autenticação não fornecido'));
    return;
  }

  void authService
    .authenticateAccessToken(token)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch(next);
}

/**
 * Factory de middleware de autorização por role.
 * Verifica se req.user.role está na lista de roles permitidos.
 *
 */
export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Usuário não autenticado'));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError('Usuário sem permissão para acessar este recurso'));
      return;
    }

    next();
  };
}
