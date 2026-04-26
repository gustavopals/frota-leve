import type { NextFunction, Request, Response } from 'express';
import type { PlanType } from '@frota-leve/database';
import { UnauthorizedError } from '../../shared/errors';
import { aiService } from './ai.service';
import type { AIActorContext } from './ai.types';
import type { UsageQueryInput } from './ai.validators';

export class AIController {
  private getActorContext(req: Request): AIActorContext {
    if (!req.tenant) {
      throw new UnauthorizedError('Tenant não identificado');
    }

    if (!req.user?.id) {
      throw new UnauthorizedError('Usuário não autenticado');
    }

    return {
      tenantId: req.tenant.id,
      tenantPlan: req.tenant.plan as PlanType,
      userId: req.user.id,
    };
  }

  getUsage = (req: Request, res: Response, next: NextFunction): void => {
    const context = this.getActorContext(req);
    const { period } = req.query as unknown as UsageQueryInput;

    void aiService
      .getUsage(context, period)
      .then((result) => res.status(200).json({ success: true, data: result }))
      .catch(next);
  };

  getQuota = (req: Request, res: Response, next: NextFunction): void => {
    const context = this.getActorContext(req);

    void aiService
      .getQuota(context)
      .then((result) => res.status(200).json({ success: true, data: result }))
      .catch(next);
  };
}
