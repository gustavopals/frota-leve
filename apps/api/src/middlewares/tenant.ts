import type { Request, Response, NextFunction } from 'express';
import { TenantStatus } from '@frota-leve/database';
import { prisma } from '../config/database';
import { ForbiddenError, UnauthorizedError } from '../shared/errors';

/**
 * Middleware de identificação e validação do tenant.
 * Lê tenantId de req.user (populado pelo middleware de auth),
 * busca o tenant no banco e popula req.tenant.
 *
 */
export function tenantMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new UnauthorizedError('Usuário não autenticado'));
    return;
  }

  void prisma.tenant
    .findUnique({
      where: {
        id: req.user.tenantId,
      },
      select: {
        id: true,
        name: true,
        plan: true,
        status: true,
        trialEndsAt: true,
      },
    })
    .then((tenant) => {
      if (!tenant) {
        throw new UnauthorizedError('Tenant do usuário autenticado não encontrado');
      }

      if (tenant.status === TenantStatus.SUSPENDED || tenant.status === TenantStatus.CANCELLED) {
        throw new ForbiddenError('Tenant suspenso ou cancelado');
      }

      req.tenant = tenant;
      next();
    })
    .catch(next);
}
