import { Router } from 'express';
import { UserRole } from '@frota-leve/database';
import { authenticate, authorize } from '../../middlewares/auth';
import { tenantMiddleware } from '../../middlewares/tenant';
import { validate } from '../../middlewares/validate';
import { requirePlanFeature } from '../../middlewares/plan-gate';
import { TiresController } from './tires.controller';
import {
  createTireInspectionBodySchema,
  createTireBodySchema,
  listTireInspectionsQuerySchema,
  listTiresQuerySchema,
  moveTireBodySchema,
  replaceTireBodySchema,
  tireAlertsQuerySchema,
  tireIdParamSchema,
  tireStatsQuerySchema,
} from './tires.validators';

const tiresController = new TiresController();

export const tiresRouter = Router();

// Autenticação + verificação de tenant + gate de plano (bloqueia ESSENTIAL)
tiresRouter.use(authenticate, tenantMiddleware, requirePlanFeature('hasTires'));

tiresRouter.get('/alerts', validate({ query: tireAlertsQuerySchema }), tiresController.listAlerts);

tiresRouter.get('/stats', validate({ query: tireStatsQuerySchema }), tiresController.stats);

tiresRouter.get('/', validate({ query: listTiresQuerySchema }), tiresController.list);

tiresRouter.post(
  '/',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ body: createTireBodySchema }),
  tiresController.create,
);

tiresRouter.get(
  '/:id/inspections',
  validate({ params: tireIdParamSchema, query: listTireInspectionsQuerySchema }),
  tiresController.listInspections,
);

tiresRouter.post(
  '/:id/inspections',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER, UserRole.DRIVER),
  validate({ params: tireIdParamSchema, body: createTireInspectionBodySchema }),
  tiresController.registerInspection,
);

tiresRouter.patch(
  '/:id/move',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ params: tireIdParamSchema, body: moveTireBodySchema }),
  tiresController.move,
);

tiresRouter.get('/:id', validate({ params: tireIdParamSchema }), tiresController.getById);

tiresRouter.put(
  '/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ params: tireIdParamSchema, body: replaceTireBodySchema }),
  tiresController.replace,
);

tiresRouter.delete(
  '/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ params: tireIdParamSchema }),
  tiresController.remove,
);
