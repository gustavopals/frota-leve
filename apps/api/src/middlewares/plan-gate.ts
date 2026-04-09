import type { Request, Response, NextFunction } from 'express';
import { PLAN_LIMITS } from '@frota-leve/shared';
import type { PlanType as SharedPlanType } from '@frota-leve/shared';
import { PlanLimitError, UnauthorizedError } from '../shared/errors';

type PlanFeature = keyof (typeof PLAN_LIMITS)[SharedPlanType];

/**
 * Middleware de gate de plano.
 * Bloqueia a rota quando o plano do tenant não inclui a feature solicitada.
 * Deve ser usado após tenantMiddleware (que popula req.tenant).
 */
export function requirePlanFeature(feature: PlanFeature) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      next(new UnauthorizedError('Tenant não identificado'));
      return;
    }

    const plan = req.tenant.plan as unknown as SharedPlanType;
    const limits = PLAN_LIMITS[plan];

    if (!limits || !limits[feature]) {
      next(
        new PlanLimitError(
          'Seu plano não inclui acesso a este módulo. Faça upgrade para continuar.',
        ),
      );
      return;
    }

    next();
  };
}
