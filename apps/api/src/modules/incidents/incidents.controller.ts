import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors';
import { incidentsService } from './incidents.service';
import type {
  CreateIncidentInput,
  IncidentIdParams,
  IncidentStatsQueryInput,
  ListIncidentsQueryInput,
  UpdateIncidentInput,
} from './incidents.validators';

export class IncidentsController {
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
    void incidentsService
      .listIncidents(this.getActorContext(req), req.query as unknown as ListIncidentsQueryInput)
      .then((result) => res.status(200).json(result))
      .catch(next);
  };

  getById = (req: Request, res: Response, next: NextFunction): void => {
    void incidentsService
      .getIncidentById(this.getActorContext(req), (req.params as IncidentIdParams).id)
      .then((result) => res.status(200).json(result))
      .catch(next);
  };

  create = (req: Request, res: Response, next: NextFunction): void => {
    void incidentsService
      .createIncident(this.getActorContext(req), req.body as CreateIncidentInput)
      .then((result) => res.status(201).json(result))
      .catch(next);
  };

  update = (req: Request, res: Response, next: NextFunction): void => {
    void incidentsService
      .updateIncident(
        this.getActorContext(req),
        (req.params as IncidentIdParams).id,
        req.body as UpdateIncidentInput,
      )
      .then((result) => res.status(200).json(result))
      .catch(next);
  };

  remove = (req: Request, res: Response, next: NextFunction): void => {
    void incidentsService
      .deleteIncident(this.getActorContext(req), (req.params as IncidentIdParams).id)
      .then((result) => res.status(200).json(result))
      .catch(next);
  };

  stats = (req: Request, res: Response, next: NextFunction): void => {
    void incidentsService
      .getStats(this.getActorContext(req), req.query as unknown as IncidentStatsQueryInput)
      .then((result) => res.status(200).json(result))
      .catch(next);
  };
}
