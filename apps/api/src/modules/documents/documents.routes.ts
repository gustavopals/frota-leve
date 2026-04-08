import { Router } from 'express';
import { UserRole } from '@frota-leve/database';
import { authenticate, authorize } from '../../middlewares/auth';
import { tenantMiddleware } from '../../middlewares/tenant';
import { validate } from '../../middlewares/validate';
import { DocumentsController } from './documents.controller';
import {
  createDocumentBodySchema,
  documentIdParamSchema,
  listDocumentsQuerySchema,
  pendingDocumentsQuerySchema,
  replaceDocumentBodySchema,
} from './documents.validators';

const controller = new DocumentsController();

export const documentsRouter = Router();

documentsRouter.use(authenticate, tenantMiddleware);

documentsRouter.get('/', validate({ query: listDocumentsQuerySchema }), controller.list);

documentsRouter.get(
  '/pending',
  validate({ query: pendingDocumentsQuerySchema }),
  controller.listPending,
);

documentsRouter.post(
  '/',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ body: createDocumentBodySchema }),
  controller.create,
);

documentsRouter.get('/:id', validate({ params: documentIdParamSchema }), controller.getById);

documentsRouter.put(
  '/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({
    params: documentIdParamSchema,
    body: replaceDocumentBodySchema,
  }),
  controller.replace,
);

documentsRouter.delete(
  '/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ params: documentIdParamSchema }),
  controller.remove,
);
