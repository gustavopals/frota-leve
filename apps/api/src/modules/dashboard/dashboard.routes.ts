import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { tenantMiddleware } from '../../middlewares/tenant';
import { DashboardController } from './dashboard.controller';

const controller = new DashboardController();

export const dashboardRouter = Router();

dashboardRouter.use(authenticate, tenantMiddleware);
dashboardRouter.get('/summary', controller.summary);
