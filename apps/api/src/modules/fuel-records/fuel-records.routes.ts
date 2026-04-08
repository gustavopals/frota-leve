import { Router } from 'express';
import { UserRole } from '@frota-leve/database';
import { authenticate, authorize } from '../../middlewares/auth';
import { tenantMiddleware } from '../../middlewares/tenant';
import { validate } from '../../middlewares/validate';
import { FuelRecordsController } from './fuel-records.controller';
import {
  createFuelRecordBodySchema,
  fuelRecordIdParamSchema,
  fuelRecordRankingQuerySchema,
  fuelRecordStatsQuerySchema,
  listFuelRecordsQuerySchema,
  replaceFuelRecordBodySchema,
  vehicleIdParamSchema,
} from './fuel-records.validators';

const controller = new FuelRecordsController();

// ─── /api/v1/fuel-records ─────────────────────────────────────────────────────

export const fuelRecordsRouter = Router();

fuelRecordsRouter.use(authenticate, tenantMiddleware);

// Stats and ranking come before /:id to avoid param collision
fuelRecordsRouter.get('/stats', validate({ query: fuelRecordStatsQuerySchema }), controller.stats);

fuelRecordsRouter.get(
  '/ranking',
  validate({ query: fuelRecordRankingQuerySchema }),
  controller.ranking,
);

fuelRecordsRouter.get('/', validate({ query: listFuelRecordsQuerySchema }), controller.list);

fuelRecordsRouter.post(
  '/',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ body: createFuelRecordBodySchema }),
  controller.create,
);

fuelRecordsRouter.get('/:id', validate({ params: fuelRecordIdParamSchema }), controller.getById);

fuelRecordsRouter.put(
  '/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({
    params: fuelRecordIdParamSchema,
    body: replaceFuelRecordBodySchema,
  }),
  controller.replace,
);

fuelRecordsRouter.delete(
  '/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ params: fuelRecordIdParamSchema }),
  controller.remove,
);

// ─── /api/v1/vehicles/:vehicleId/fuel-records ────────────────────────────────
// Convenience nested route — delegates to the same controller.list

export const vehicleFuelRecordsRouter = Router({ mergeParams: true });

vehicleFuelRecordsRouter.use(authenticate, tenantMiddleware);

vehicleFuelRecordsRouter.get(
  '/',
  validate({
    params: vehicleIdParamSchema,
    query: listFuelRecordsQuerySchema,
  }),
  controller.list,
);
