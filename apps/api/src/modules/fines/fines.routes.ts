import { Router } from 'express';
import { UserRole } from '@frota-leve/database';
import { authenticate, authorize } from '../../middlewares/auth';
import { tenantMiddleware } from '../../middlewares/tenant';
import { validate } from '../../middlewares/validate';
import { spreadsheetUpload } from '../../middlewares/upload';
import { FinesController } from './fines.controller';
import {
  createFineBodySchema,
  fineIdParamSchema,
  fineStatsQuerySchema,
  listFinesQuerySchema,
  updateFineBodySchema,
} from './fines.validators';

const finesController = new FinesController();

export const finesRouter = Router();

finesRouter.use(authenticate, tenantMiddleware);

finesRouter.get('/', validate({ query: listFinesQuerySchema }), finesController.list);

finesRouter.get('/stats', validate({ query: fineStatsQuerySchema }), finesController.stats);

finesRouter.post(
  '/import',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCIAL),
  spreadsheetUpload,
  finesController.import,
);

finesRouter.post(
  '/',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCIAL),
  validate({ body: createFineBodySchema }),
  finesController.create,
);

finesRouter.get('/:id', validate({ params: fineIdParamSchema }), finesController.getById);

finesRouter.put(
  '/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.FINANCIAL),
  validate({ params: fineIdParamSchema, body: updateFineBodySchema }),
  finesController.update,
);

finesRouter.delete(
  '/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ params: fineIdParamSchema }),
  finesController.remove,
);
