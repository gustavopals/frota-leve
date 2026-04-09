import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors';
import { financialService } from './financial.service';
import type {
  FinancialComparisonQueryInput,
  FinancialOverviewQueryInput,
  FinancialTcoQueryInput,
  FinancialVehicleIdParams,
} from './financial.validators';

export class FinancialController {
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

  tco = (req: Request, res: Response, next: NextFunction): void => {
    void financialService
      .getVehicleTco(
        this.getActorContext(req),
        (req.params as FinancialVehicleIdParams).vehicleId,
        req.query as unknown as FinancialTcoQueryInput,
      )
      .then((result) => res.status(200).json(result))
      .catch(next);
  };

  overview = (req: Request, res: Response, next: NextFunction): void => {
    void financialService
      .getOverview(this.getActorContext(req), req.query as unknown as FinancialOverviewQueryInput)
      .then((result) => res.status(200).json(result))
      .catch(next);
  };

  comparison = (req: Request, res: Response, next: NextFunction): void => {
    void financialService
      .getComparison(
        this.getActorContext(req),
        req.query as unknown as FinancialComparisonQueryInput,
      )
      .then((result) => res.status(200).json(result))
      .catch(next);
  };
}
