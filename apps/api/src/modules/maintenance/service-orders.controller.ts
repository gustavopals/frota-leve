import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors';
import { serviceOrdersService } from './service-orders.service';
import type {
  ServiceOrderCreateInput,
  ServiceOrderIdParams,
  ServiceOrderListQueryInput,
  ServiceOrderReplaceInput,
} from './service-orders.validators';

export class ServiceOrdersController {
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
    void serviceOrdersService
      .listServiceOrders(
        this.getActorContext(req),
        req.query as unknown as ServiceOrderListQueryInput,
      )
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  getById = (req: Request, res: Response, next: NextFunction): void => {
    void serviceOrdersService
      .getServiceOrderById(this.getActorContext(req), (req.params as ServiceOrderIdParams).id)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  create = (req: Request, res: Response, next: NextFunction): void => {
    void serviceOrdersService
      .createServiceOrder(this.getActorContext(req), req.body as ServiceOrderCreateInput)
      .then((result) => {
        res.status(201).json(result);
      })
      .catch(next);
  };

  replace = (req: Request, res: Response, next: NextFunction): void => {
    void serviceOrdersService
      .replaceServiceOrder(
        this.getActorContext(req),
        (req.params as ServiceOrderIdParams).id,
        req.body as ServiceOrderReplaceInput,
      )
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  remove = (req: Request, res: Response, next: NextFunction): void => {
    void serviceOrdersService
      .deleteServiceOrder(this.getActorContext(req), (req.params as ServiceOrderIdParams).id)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };
}
