import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { tenantMiddleware } from '../../middlewares/tenant';
import { validate } from '../../middlewares/validate';
import { NotificationsController } from './notifications.controller';
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from './notifications.validators';

const notificationsController = new NotificationsController();

export const notificationsRouter = Router();

notificationsRouter.use(authenticate, tenantMiddleware);

notificationsRouter.get(
  '/',
  validate({ query: listNotificationsQuerySchema }),
  notificationsController.list,
);

notificationsRouter.patch('/read-all', notificationsController.markAllAsRead);

notificationsRouter.patch(
  '/:id/read',
  validate({ params: notificationIdParamSchema }),
  notificationsController.markAsRead,
);
