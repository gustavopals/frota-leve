import { Router } from 'express';
import multer from 'multer';
import { UserRole } from '@frota-leve/database';
import { authenticate, authorize } from '../../middlewares/auth';
import { tenantMiddleware } from '../../middlewares/tenant';
import { validate } from '../../middlewares/validate';
import { ValidationError } from '../../shared/errors';
import { VehiclesController } from './vehicles.controller';
import {
  createVehicleBodySchema,
  exportVehiclesQuerySchema,
  listVehiclesQuerySchema,
  replaceVehicleBodySchema,
  updateVehicleMileageBodySchema,
  updateVehicleStatusBodySchema,
  vehicleIdParamSchema,
  vehicleStatsQuerySchema,
} from './vehicles.validators';

const controller = new VehiclesController();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

function importUploadMiddleware() {
  return (
    req: Parameters<ReturnType<typeof upload.single>>[0],
    res: Parameters<ReturnType<typeof upload.single>>[1],
    next: Parameters<ReturnType<typeof upload.single>>[2],
  ): void => {
    upload.single('file')(req, res, (error) => {
      if (error) {
        next(new ValidationError(error.message));
        return;
      }

      next();
    });
  };
}

export const vehiclesRouter = Router();

vehiclesRouter.use(authenticate, tenantMiddleware);

vehiclesRouter.get('/stats', validate({ query: vehicleStatsQuerySchema }), controller.stats);
vehiclesRouter.get('/export', validate({ query: exportVehiclesQuerySchema }), controller.export);
vehiclesRouter.post(
  '/import',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  importUploadMiddleware(),
  controller.import,
);
vehiclesRouter.get('/', validate({ query: listVehiclesQuerySchema }), controller.list);
vehiclesRouter.post(
  '/',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate(createVehicleBodySchema),
  controller.create,
);
vehiclesRouter.get('/:id', validate({ params: vehicleIdParamSchema }), controller.getById);
vehiclesRouter.put(
  '/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({
    params: vehicleIdParamSchema,
    body: replaceVehicleBodySchema,
  }),
  controller.replace,
);
vehiclesRouter.patch(
  '/:id/status',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({
    params: vehicleIdParamSchema,
    body: updateVehicleStatusBodySchema,
  }),
  controller.updateStatus,
);
vehiclesRouter.patch(
  '/:id/mileage',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({
    params: vehicleIdParamSchema,
    body: updateVehicleMileageBodySchema,
  }),
  controller.updateMileage,
);
vehiclesRouter.delete(
  '/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ params: vehicleIdParamSchema }),
  controller.remove,
);
