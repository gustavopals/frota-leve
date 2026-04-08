import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors';
import { maintenanceService } from './maintenance.service';
import type {
  MaintenanceAlertsQueryInput,
  MaintenancePlanCreateInput,
  MaintenancePlanIdParams,
  MaintenancePlanListQueryInput,
  MaintenancePlanReplaceInput,
  MaintenanceStatsQueryInput,
} from './maintenance.validators';

export class MaintenanceController {
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

  listPlans = (req: Request, res: Response, next: NextFunction): void => {
    void maintenanceService
      .listMaintenancePlans(
        this.getActorContext(req),
        req.query as unknown as MaintenancePlanListQueryInput,
      )
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  listAlerts = (req: Request, res: Response, next: NextFunction): void => {
    void maintenanceService
      .getMaintenanceAlerts(
        this.getActorContext(req),
        req.query as unknown as MaintenanceAlertsQueryInput,
      )
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  stats = (req: Request, res: Response, next: NextFunction): void => {
    void maintenanceService
      .getMaintenanceStats(
        this.getActorContext(req),
        req.query as unknown as MaintenanceStatsQueryInput,
      )
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  getPlanById = (req: Request, res: Response, next: NextFunction): void => {
    void maintenanceService
      .getMaintenancePlanById(this.getActorContext(req), (req.params as MaintenancePlanIdParams).id)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  createPlan = (req: Request, res: Response, next: NextFunction): void => {
    void maintenanceService
      .createMaintenancePlan(this.getActorContext(req), req.body as MaintenancePlanCreateInput)
      .then((result) => {
        res.status(201).json(result);
      })
      .catch(next);
  };

  replacePlan = (req: Request, res: Response, next: NextFunction): void => {
    void maintenanceService
      .replaceMaintenancePlan(
        this.getActorContext(req),
        (req.params as MaintenancePlanIdParams).id,
        req.body as MaintenancePlanReplaceInput,
      )
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  removePlan = (req: Request, res: Response, next: NextFunction): void => {
    void maintenanceService
      .deleteMaintenancePlan(this.getActorContext(req), (req.params as MaintenancePlanIdParams).id)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };
}
