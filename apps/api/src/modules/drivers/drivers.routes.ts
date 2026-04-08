import { Router } from 'express';
import multer from 'multer';
import { UserRole } from '@frota-leve/database';
import { authenticate, authorize } from '../../middlewares/auth';
import { tenantMiddleware } from '../../middlewares/tenant';
import { validate } from '../../middlewares/validate';
import { ValidationError } from '../../shared/errors';
import { DriversController } from './drivers.controller';
import {
  createDriverBodySchema,
  driverIdParamSchema,
  driverImportQuerySchema,
  linkVehicleParamSchema,
  listDriversQuerySchema,
  replaceDriverBodySchema,
} from './drivers.validators';

const controller = new DriversController();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
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

export const driversRouter = Router();

driversRouter.use(authenticate, tenantMiddleware);

// Rota de importação deve vir antes de /:id para não conflitar
driversRouter.post(
  '/import',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ query: driverImportQuerySchema }),
  importUploadMiddleware(),
  controller.import,
);

driversRouter.get('/', validate({ query: listDriversQuerySchema }), controller.list);

driversRouter.post(
  '/',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ body: createDriverBodySchema }),
  controller.create,
);

driversRouter.get('/:id', validate({ params: driverIdParamSchema }), controller.getById);

driversRouter.put(
  '/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ params: driverIdParamSchema, body: replaceDriverBodySchema }),
  controller.replace,
);

driversRouter.delete(
  '/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ params: driverIdParamSchema }),
  controller.remove,
);

driversRouter.get('/:id/history', validate({ params: driverIdParamSchema }), controller.history);

driversRouter.patch(
  '/:id/link-vehicle/:vehicleId',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ params: linkVehicleParamSchema }),
  controller.linkVehicle,
);
