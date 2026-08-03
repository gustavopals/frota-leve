import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../../shared/errors';
import { reportsService, type ReportActorContext } from './reports.service';
import type {
  ListReportsQueryInput,
  OnDemandReportInput,
  ReportIdParams,
} from './reports.validators';

export class ReportsController {
  private getActorContext(req: Request): ReportActorContext {
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
    const query = req.query as unknown as ListReportsQueryInput;

    void reportsService
      .list(context, query)
      .then((result) => res.status(200).json({ success: true, ...result }))
      .catch(next);
  };

  getById = (req: Request, res: Response, next: NextFunction): void => {
    const context = this.getActorContext(req);
    const { id } = req.params as unknown as ReportIdParams;

    void reportsService
      .getById(context, id)
      .then((data) => res.status(200).json({ success: true, data }))
      .catch(next);
  };

  getPdf = (req: Request, res: Response, next: NextFunction): void => {
    const context = this.getActorContext(req);
    const { id } = req.params as unknown as ReportIdParams;

    void reportsService
      .getPdf(context, id)
      .then(({ filename, buffer }) => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(buffer);
      })
      .catch(next);
  };

  generateOnDemand = (req: Request, res: Response, next: NextFunction): void => {
    const context = this.getActorContext(req);
    const { period } = req.body as OnDemandReportInput;

    void reportsService
      .generateOnDemand(context, period)
      .then((data) => res.status(201).json({ success: true, data }))
      .catch(next);
  };
}
