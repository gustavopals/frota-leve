import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors';
import { vehiclesService } from './vehicles.service';
import type {
  VehicleCreateInput,
  VehicleExportQueryInput,
  VehicleIdParams,
  VehicleListQueryInput,
  VehicleMileageUpdateInput,
  VehicleReplaceInput,
  VehicleStatsQueryInput,
  VehicleStatusUpdateInput,
} from './vehicles.validators';

export class VehiclesController {
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
    void vehiclesService
      .listVehicles(this.getActorContext(req), req.query as unknown as VehicleListQueryInput)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  getById = (req: Request, res: Response, next: NextFunction): void => {
    void vehiclesService
      .getVehicleById(this.getActorContext(req), (req.params as VehicleIdParams).id)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  create = (req: Request, res: Response, next: NextFunction): void => {
    void vehiclesService
      .createVehicle(this.getActorContext(req), req.body as VehicleCreateInput)
      .then((result) => {
        res.status(201).json(result);
      })
      .catch(next);
  };

  replace = (req: Request, res: Response, next: NextFunction): void => {
    void vehiclesService
      .replaceVehicle(
        this.getActorContext(req),
        (req.params as VehicleIdParams).id,
        req.body as VehicleReplaceInput,
      )
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  updateStatus = (req: Request, res: Response, next: NextFunction): void => {
    void vehiclesService
      .updateVehicleStatus(
        this.getActorContext(req),
        (req.params as VehicleIdParams).id,
        req.body as VehicleStatusUpdateInput,
      )
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  updateMileage = (req: Request, res: Response, next: NextFunction): void => {
    void vehiclesService
      .updateVehicleMileage(
        this.getActorContext(req),
        (req.params as VehicleIdParams).id,
        req.body as VehicleMileageUpdateInput,
      )
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  remove = (req: Request, res: Response, next: NextFunction): void => {
    void vehiclesService
      .deleteVehicle(this.getActorContext(req), (req.params as VehicleIdParams).id)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  import = (req: Request, res: Response, next: NextFunction): void => {
    void vehiclesService
      .importVehicles(this.getActorContext(req), req.file)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  export = (req: Request, res: Response, next: NextFunction): void => {
    void vehiclesService
      .exportVehicles(this.getActorContext(req), req.query as unknown as VehicleExportQueryInput)
      .then((result) => {
        res
          .status(200)
          .setHeader('Content-Type', 'text/csv; charset=utf-8')
          .setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`)
          .send(result.content);
      })
      .catch(next);
  };

  stats = (req: Request, res: Response, next: NextFunction): void => {
    void vehiclesService
      .getVehicleStats(this.getActorContext(req), req.query as unknown as VehicleStatsQueryInput)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };
}
