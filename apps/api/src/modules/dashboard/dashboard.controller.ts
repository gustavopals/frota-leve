import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors';
import { dashboardService } from './dashboard.service';

export class DashboardController {
  private getActorContext(req: Request) {
    if (!req.tenant) {
      throw new UnauthorizedError('Tenant não identificado');
    }

    return {
      tenantId: req.tenant.id,
      tenantPlan: req.tenant.plan,
      userId: req.user?.id ?? null,
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') ?? null,
    };
  }

  summary = (req: Request, res: Response, next: NextFunction): void => {
    void dashboardService
      .getSummary(this.getActorContext(req))
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };
}
