import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors';
import { driversService } from './drivers.service';
import type {
  DriverCreateInput,
  DriverIdParams,
  DriverImportQueryInput,
  DriverListQueryInput,
  DriverReplaceInput,
  LinkVehicleParams,
} from './drivers.validators';

export class DriversController {
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
    void driversService
      .listDrivers(this.getActorContext(req), req.query as unknown as DriverListQueryInput)
      .then((result) => res.status(200).json(result))
      .catch(next);
  };

  getById = (req: Request, res: Response, next: NextFunction): void => {
    void driversService
      .getDriverById(this.getActorContext(req), (req.params as DriverIdParams).id)
      .then((result) => res.status(200).json(result))
      .catch(next);
  };

  create = (req: Request, res: Response, next: NextFunction): void => {
    void driversService
      .createDriver(this.getActorContext(req), req.body as DriverCreateInput)
      .then((result) => res.status(201).json(result))
      .catch(next);
  };

  replace = (req: Request, res: Response, next: NextFunction): void => {
    void driversService
      .replaceDriver(
        this.getActorContext(req),
        (req.params as DriverIdParams).id,
        req.body as DriverReplaceInput,
      )
      .then((result) => res.status(200).json(result))
      .catch(next);
  };

  remove = (req: Request, res: Response, next: NextFunction): void => {
    void driversService
      .deleteDriver(this.getActorContext(req), (req.params as DriverIdParams).id)
      .then((result) => res.status(200).json(result))
      .catch(next);
  };

  history = (req: Request, res: Response, next: NextFunction): void => {
    void driversService
      .getDriverHistory(this.getActorContext(req), (req.params as DriverIdParams).id)
      .then((result) => res.status(200).json(result))
      .catch(next);
  };

  linkVehicle = (req: Request, res: Response, next: NextFunction): void => {
    const params = req.params as LinkVehicleParams;
    void driversService
      .linkVehicle(this.getActorContext(req), params.id, params.vehicleId)
      .then((result) => res.status(200).json(result))
      .catch(next);
  };

  import = (req: Request, res: Response, next: NextFunction): void => {
    void driversService
      .importDrivers(
        this.getActorContext(req),
        req.file,
        req.query as unknown as DriverImportQueryInput,
      )
      .then((result) => res.status(200).json(result))
      .catch(next);
  };
}
