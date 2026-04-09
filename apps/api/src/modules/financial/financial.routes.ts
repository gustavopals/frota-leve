import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { tenantMiddleware } from '../../middlewares/tenant';
import { validate } from '../../middlewares/validate';
import { FinancialController } from './financial.controller';
import {
  financialComparisonQuerySchema,
  financialOverviewQuerySchema,
  financialTcoQuerySchema,
  financialVehicleIdParamSchema,
} from './financial.validators';

const financialController = new FinancialController();

export const financialRouter = Router();

financialRouter.use(authenticate, tenantMiddleware);

financialRouter.get(
  '/tco/:vehicleId',
  validate({ params: financialVehicleIdParamSchema, query: financialTcoQuerySchema }),
  financialController.tco,
);

financialRouter.get(
  '/overview',
  validate({ query: financialOverviewQuerySchema }),
  financialController.overview,
);

financialRouter.get(
  '/comparison',
  validate({ query: financialComparisonQuerySchema }),
  financialController.comparison,
);
