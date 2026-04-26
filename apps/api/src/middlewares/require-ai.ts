import type { Request, Response, NextFunction } from 'express';
import { PLAN_LIMITS } from '@frota-leve/shared';
import type { PlanType as SharedPlanType } from '@frota-leve/shared';
import { AIPlanRequiredError, UnauthorizedError } from '../shared/errors';

/**
 * Garante que o plano do tenant inclui recursos de IA (`PLAN_LIMITS[plan].hasAI === true`).
 * Deve ser usado após `tenantMiddleware`.
 */
export function requireAI(req: Request, _res: Response, next: NextFunction): void {
  if (!req.tenant) {
    next(new UnauthorizedError('Tenant não identificado'));
    return;
  }

  const plan = req.tenant.plan as unknown as SharedPlanType;
  const limits = PLAN_LIMITS[plan];

  if (!limits?.hasAI) {
    next(new AIPlanRequiredError());
    return;
  }

  next();
}
