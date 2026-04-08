import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors';
import { fuelRecordsService } from './fuel-records.service';
import type {
  FuelRecordCreateInput,
  FuelRecordIdParams,
  FuelRecordListQueryInput,
  FuelRecordRankingQueryInput,
  FuelRecordReplaceInput,
  FuelRecordStatsQueryInput,
  VehicleIdParam,
} from './fuel-records.validators';

export class FuelRecordsController {
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
    const query = req.query as unknown as FuelRecordListQueryInput;

    // Nested route: /vehicles/:vehicleId/fuel-records injects vehicleId via params
    const vehicleId = (req.params as Partial<VehicleIdParam>).vehicleId;
    if (vehicleId && !query.vehicleId) {
      (query as Record<string, unknown>).vehicleId = vehicleId;
    }

    void fuelRecordsService
      .listFuelRecords(this.getActorContext(req), query)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  getById = (req: Request, res: Response, next: NextFunction): void => {
    void fuelRecordsService
      .getFuelRecordById(this.getActorContext(req), (req.params as FuelRecordIdParams).id)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  create = (req: Request, res: Response, next: NextFunction): void => {
    void fuelRecordsService
      .createFuelRecord(this.getActorContext(req), req.body as FuelRecordCreateInput)
      .then((result) => {
        res.status(201).json(result);
      })
      .catch(next);
  };

  replace = (req: Request, res: Response, next: NextFunction): void => {
    void fuelRecordsService
      .replaceFuelRecord(
        this.getActorContext(req),
        (req.params as FuelRecordIdParams).id,
        req.body as FuelRecordReplaceInput,
      )
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  remove = (req: Request, res: Response, next: NextFunction): void => {
    void fuelRecordsService
      .deleteFuelRecord(this.getActorContext(req), (req.params as FuelRecordIdParams).id)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  stats = (req: Request, res: Response, next: NextFunction): void => {
    void fuelRecordsService
      .getFuelRecordStats(
        this.getActorContext(req),
        req.query as unknown as FuelRecordStatsQueryInput,
      )
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  ranking = (req: Request, res: Response, next: NextFunction): void => {
    void fuelRecordsService
      .getFuelRecordRanking(
        this.getActorContext(req),
        req.query as unknown as FuelRecordRankingQueryInput,
      )
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };
}
