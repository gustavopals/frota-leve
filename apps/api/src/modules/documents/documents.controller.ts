import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors';
import { documentsService } from './documents.service';
import type {
  DocumentCreateInput,
  DocumentIdParams,
  DocumentListQueryInput,
  PendingDocumentsQueryInput,
  DocumentReplaceInput,
} from './documents.validators';

export class DocumentsController {
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
    void documentsService
      .listDocuments(this.getActorContext(req), req.query as unknown as DocumentListQueryInput)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  listPending = (req: Request, res: Response, next: NextFunction): void => {
    void documentsService
      .getPendingDocuments(
        this.getActorContext(req),
        req.query as unknown as PendingDocumentsQueryInput,
      )
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  getById = (req: Request, res: Response, next: NextFunction): void => {
    void documentsService
      .getDocumentById(this.getActorContext(req), (req.params as DocumentIdParams).id)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  create = (req: Request, res: Response, next: NextFunction): void => {
    void documentsService
      .createDocument(this.getActorContext(req), req.body as DocumentCreateInput)
      .then((result) => {
        res.status(201).json(result);
      })
      .catch(next);
  };

  replace = (req: Request, res: Response, next: NextFunction): void => {
    void documentsService
      .replaceDocument(
        this.getActorContext(req),
        (req.params as DocumentIdParams).id,
        req.body as DocumentReplaceInput,
      )
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };

  remove = (req: Request, res: Response, next: NextFunction): void => {
    void documentsService
      .deleteDocument(this.getActorContext(req), (req.params as DocumentIdParams).id)
      .then((result) => {
        res.status(200).json(result);
      })
      .catch(next);
  };
}
