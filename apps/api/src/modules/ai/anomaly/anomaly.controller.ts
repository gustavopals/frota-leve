import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../../shared/errors';
import { anomalyService, type AnomalyActorContext } from './anomaly.service';
import type { AnomalyIdParams, ListAnomaliesQueryInput } from './anomaly.validators';

export class AnomalyController {
  private getActorContext(req: Request): AnomalyActorContext {
    if (!req.tenant) {
      throw new UnauthorizedError('Tenant não identificado');
    }

    if (!req.user?.id) {
      throw new UnauthorizedError('Usuário não autenticado');
    }

    return { tenantId: req.tenant.id, userId: req.user.id };
  }

  list = (req: Request, res: Response, next: NextFunction): void => {
    const context = this.getActorContext(req);
    const query = req.query as unknown as ListAnomaliesQueryInput;

    void anomalyService
      .list(context, query)
      .then((result) => res.status(200).json({ success: true, ...result }))
      .catch(next);
  };

  listInsights = (req: Request, res: Response, next: NextFunction): void => {
    const context = this.getActorContext(req);

    void anomalyService
      .listDashboardInsights(context)
      .then((data) => res.status(200).json({ success: true, data }))
      .catch(next);
  };

  getVehicleAnalysis = (req: Request, res: Response, next: NextFunction): void => {
    const context = this.getActorContext(req);
    const { id } = req.params as unknown as AnomalyIdParams;

    void anomalyService
      .getVehicleAnalysis(context, id)
      .then((data) => res.status(200).json({ success: true, data }))
      .catch(next);
  };

  acknowledge = (req: Request, res: Response, next: NextFunction): void => {
    const context = this.getActorContext(req);
    const { id } = req.params as unknown as AnomalyIdParams;

    void anomalyService
      .acknowledge(context, id)
      .then((data) => res.status(200).json({ success: true, data }))
      .catch(next);
  };

  dismiss = (req: Request, res: Response, next: NextFunction): void => {
    const context = this.getActorContext(req);
    const { id } = req.params as unknown as AnomalyIdParams;

    void anomalyService
      .dismiss(context, id)
      .then((data) => res.status(200).json({ success: true, data }))
      .catch(next);
  };
}
