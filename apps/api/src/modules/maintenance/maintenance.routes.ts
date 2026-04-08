import { Router } from 'express';
import { UserRole } from '@frota-leve/database';
import { authenticate, authorize } from '../../middlewares/auth';
import { tenantMiddleware } from '../../middlewares/tenant';
import { validate } from '../../middlewares/validate';
import { MaintenanceController } from './maintenance.controller';
import { ServiceOrdersController } from './service-orders.controller';
import {
  createMaintenancePlanBodySchema,
  maintenanceAlertsQuerySchema,
  maintenanceStatsQuerySchema,
  listMaintenancePlansQuerySchema,
  maintenancePlanIdParamSchema,
  replaceMaintenancePlanBodySchema,
} from './maintenance.validators';
import {
  createServiceOrderBodySchema,
  listServiceOrdersQuerySchema,
  replaceServiceOrderBodySchema,
  serviceOrderIdParamSchema,
} from './service-orders.validators';

const maintenanceController = new MaintenanceController();
const serviceOrdersController = new ServiceOrdersController();

export const maintenanceRouter = Router();

maintenanceRouter.use(authenticate, tenantMiddleware);

maintenanceRouter.get(
  '/alerts',
  validate({ query: maintenanceAlertsQuerySchema }),
  maintenanceController.listAlerts,
);

maintenanceRouter.get(
  '/stats',
  validate({ query: maintenanceStatsQuerySchema }),
  maintenanceController.stats,
);

maintenanceRouter.get(
  '/plans',
  validate({ query: listMaintenancePlansQuerySchema }),
  maintenanceController.listPlans,
);

maintenanceRouter.post(
  '/plans',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ body: createMaintenancePlanBodySchema }),
  maintenanceController.createPlan,
);

maintenanceRouter.get(
  '/plans/:id',
  validate({ params: maintenancePlanIdParamSchema }),
  maintenanceController.getPlanById,
);

maintenanceRouter.put(
  '/plans/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({
    params: maintenancePlanIdParamSchema,
    body: replaceMaintenancePlanBodySchema,
  }),
  maintenanceController.replacePlan,
);

maintenanceRouter.delete(
  '/plans/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ params: maintenancePlanIdParamSchema }),
  maintenanceController.removePlan,
);

maintenanceRouter.get(
  '/service-orders',
  validate({ query: listServiceOrdersQuerySchema }),
  serviceOrdersController.list,
);

maintenanceRouter.post(
  '/service-orders',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ body: createServiceOrderBodySchema }),
  serviceOrdersController.create,
);

maintenanceRouter.get(
  '/service-orders/:id',
  validate({ params: serviceOrderIdParamSchema }),
  serviceOrdersController.getById,
);

maintenanceRouter.put(
  '/service-orders/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({
    params: serviceOrderIdParamSchema,
    body: replaceServiceOrderBodySchema,
  }),
  serviceOrdersController.replace,
);

maintenanceRouter.delete(
  '/service-orders/:id',
  authorize(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER),
  validate({ params: serviceOrderIdParamSchema }),
  serviceOrdersController.remove,
);
