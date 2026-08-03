import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors';
import { mobileService } from './mobile.service';
import type { MobileActorContext } from './mobile.types';
import type {
  MobileChecklistExecutionInput,
  MobileFuelRecordInput,
  MobileProblemInput,
  SignResponsibilityTermInput,
} from './mobile.validators';

export class MobileController {
  private actor(req: Request): MobileActorContext {
    if (!req.user || !req.tenant) throw new UnauthorizedError('Motorista não autenticado');
    return {
      tenantId: req.tenant.id,
      tenantPlan: req.tenant.plan,
      userId: req.user.id,
      ipAddress: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    };
  }

  context = (req: Request, res: Response, next: NextFunction): void => {
    void mobileService
      .getContext(this.actor(req))
      .then((data) => res.status(200).json({ success: true, data }))
      .catch(next);
  };

  listChecklistTemplates = (req: Request, res: Response, next: NextFunction): void => {
    void mobileService
      .listChecklistTemplates(this.actor(req))
      .then((data) => res.status(200).json({ success: true, data }))
      .catch(next);
  };

  executeChecklist = (req: Request, res: Response, next: NextFunction): void => {
    void mobileService
      .executeChecklist(this.actor(req), req.body as MobileChecklistExecutionInput)
      .then((data) => res.status(201).json({ success: true, data }))
      .catch(next);
  };

  createFuelRecord = (req: Request, res: Response, next: NextFunction): void => {
    void mobileService
      .createFuelRecord(this.actor(req), req.body as MobileFuelRecordInput)
      .then((data) => res.status(201).json({ success: true, data }))
      .catch(next);
  };

  reportProblem = (req: Request, res: Response, next: NextFunction): void => {
    void mobileService
      .reportProblem(this.actor(req), req.body as MobileProblemInput)
      .then((data) => res.status(201).json({ success: true, data }))
      .catch(next);
  };

  signResponsibilityTerm = (req: Request, res: Response, next: NextFunction): void => {
    void mobileService
      .signResponsibilityTerm(
        this.actor(req),
        req.params['id'] as string,
        req.body as SignResponsibilityTermInput,
      )
      .then((data) => res.status(200).json({ success: true, data }))
      .catch(next);
  };
}
