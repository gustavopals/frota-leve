import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors';
import { tiresService } from './tires.service';
import type {
  CreateTireInspectionInput,
  CreateTireInput,
  ListTiresQueryInput,
  MoveTireInput,
  ReplaceTireInput,
  TireAlertsQueryInput,
  TireIdParams,
  TireStatsQueryInput,
} from './tires.validators';

export class TiresController {
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

  list = (req: Request, res: Response, next: NextFunction): void => {
    void tiresService
      .listTires(this.getActorContext(req), req.query as unknown as ListTiresQueryInput)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  listAlerts = (req: Request, res: Response, next: NextFunction): void => {
    void tiresService
      .getReplacementAlerts(this.getActorContext(req), req.query as unknown as TireAlertsQueryInput)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  stats = (req: Request, res: Response, next: NextFunction): void => {
    void tiresService
      .getStats(this.getActorContext(req), req.query as unknown as TireStatsQueryInput)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  getById = (req: Request, res: Response, next: NextFunction): void => {
    void tiresService
      .getTireById(this.getActorContext(req), (req.params as TireIdParams).id)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  create = (req: Request, res: Response, next: NextFunction): void => {
    void tiresService
      .createTire(this.getActorContext(req), req.body as CreateTireInput)
      .then((result) => {
        res.status(201).json(result);
      })
      .catch(next);
  };

  replace = (req: Request, res: Response, next: NextFunction): void => {
    void tiresService
      .replaceTire(
        this.getActorContext(req),
        (req.params as TireIdParams).id,
        req.body as ReplaceTireInput,
      )
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  remove = (req: Request, res: Response, next: NextFunction): void => {
    void tiresService
      .deleteTire(this.getActorContext(req), (req.params as TireIdParams).id)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  registerInspection = (req: Request, res: Response, next: NextFunction): void => {
    void tiresService
      .registerInspection(
        this.getActorContext(req),
        (req.params as TireIdParams).id,
        req.body as CreateTireInspectionInput,
      )
      .then((result) => {
        res.status(201).json(result);
      })
      .catch(next);
  };

  move = (req: Request, res: Response, next: NextFunction): void => {
    void tiresService
      .moveTire(
        this.getActorContext(req),
        (req.params as TireIdParams).id,
        req.body as MoveTireInput,
      )
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };
}
