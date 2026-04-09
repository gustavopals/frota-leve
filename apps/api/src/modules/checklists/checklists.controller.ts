import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors';
import { checklistsService } from './checklists.service';
import type {
  ChecklistComplianceQueryInput,
  CreateChecklistExecutionInput,
  ChecklistTemplateIdParams,
  CreateChecklistTemplateInput,
  ListChecklistExecutionsQueryInput,
  ListChecklistTemplatesQueryInput,
  ReplaceChecklistTemplateInput,
} from './checklists.validators';

export class ChecklistsController {
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

  listTemplates = (req: Request, res: Response, next: NextFunction): void => {
    void checklistsService
      .listTemplates(
        this.getActorContext(req),
        req.query as unknown as ListChecklistTemplatesQueryInput,
      )
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  listExecutions = (req: Request, res: Response, next: NextFunction): void => {
    void checklistsService
      .listExecutions(
        this.getActorContext(req),
        req.query as unknown as ListChecklistExecutionsQueryInput,
      )
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  getTemplateById = (req: Request, res: Response, next: NextFunction): void => {
    void checklistsService
      .getTemplateById(this.getActorContext(req), (req.params as ChecklistTemplateIdParams).id)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  createTemplate = (req: Request, res: Response, next: NextFunction): void => {
    void checklistsService
      .createTemplate(this.getActorContext(req), req.body as CreateChecklistTemplateInput)
      .then((result) => {
        res.status(201).json(result);
      })
      .catch(next);
  };

  executeChecklist = (req: Request, res: Response, next: NextFunction): void => {
    void checklistsService
      .executeChecklist(this.getActorContext(req), req.body as CreateChecklistExecutionInput)
      .then((result) => {
        res.status(201).json(result);
      })
      .catch(next);
  };

  compliance = (req: Request, res: Response, next: NextFunction): void => {
    void checklistsService
      .getCompliance(
        this.getActorContext(req),
        req.query as unknown as ChecklistComplianceQueryInput,
      )
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  replaceTemplate = (req: Request, res: Response, next: NextFunction): void => {
    void checklistsService
      .replaceTemplate(
        this.getActorContext(req),
        (req.params as ChecklistTemplateIdParams).id,
        req.body as ReplaceChecklistTemplateInput,
      )
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  removeTemplate = (req: Request, res: Response, next: NextFunction): void => {
    void checklistsService
      .deleteTemplate(this.getActorContext(req), (req.params as ChecklistTemplateIdParams).id)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };
}
