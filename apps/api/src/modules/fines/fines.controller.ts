import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError, ValidationError } from '../../shared/errors';
import { finesService } from './fines.service';
import { finesImportService } from './fines-import.service';
import type {
  CreateFineInput,
  FineIdParams,
  FineStatsQueryInput,
  ListFinesQueryInput,
  UpdateFineInput,
} from './fines.validators';

export class FinesController {
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
    void finesService
      .listFines(this.getActorContext(req), req.query as unknown as ListFinesQueryInput)
      .then((result) => res.status(200).json(result))
      .catch(next);
  };

  getById = (req: Request, res: Response, next: NextFunction): void => {
    void finesService
      .getFineById(this.getActorContext(req), (req.params as FineIdParams).id)
      .then((result) => res.status(200).json(result))
      .catch(next);
  };

  create = (req: Request, res: Response, next: NextFunction): void => {
    void finesService
      .createFine(this.getActorContext(req), req.body as CreateFineInput)
      .then((result) => res.status(201).json(result))
      .catch(next);
  };

  update = (req: Request, res: Response, next: NextFunction): void => {
    void finesService
      .updateFine(
        this.getActorContext(req),
        (req.params as FineIdParams).id,
        req.body as UpdateFineInput,
      )
      .then((result) => res.status(200).json(result))
      .catch(next);
  };

  remove = (req: Request, res: Response, next: NextFunction): void => {
    void finesService
      .deleteFine(this.getActorContext(req), (req.params as FineIdParams).id)
      .then((result) => res.status(200).json(result))
      .catch(next);
  };

  stats = (req: Request, res: Response, next: NextFunction): void => {
    void finesService
      .getStats(this.getActorContext(req), req.query as unknown as FineStatsQueryInput)
      .then((result) => res.status(200).json(result))
      .catch(next);
  };

  import = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.file) {
      next(new ValidationError('Nenhum arquivo enviado. Use o campo "file" no form-data.'));
      return;
    }

    void finesImportService
      .importFromFile(this.getActorContext(req), req.file)
      .then((result) => res.status(200).json(result))
      .catch(next);
  };
}
