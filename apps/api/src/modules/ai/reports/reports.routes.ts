import { Router } from 'express';
import { aiRateLimiter } from '../../../middlewares/ai-rate-limiter';
import { authorize } from '../../../middlewares/auth';
import { validate } from '../../../middlewares/validate';
import { ReportsController } from './reports.controller';
import {
  listReportsQuerySchema,
  onDemandReportSchema,
  reportIdParamsSchema,
} from './reports.validators';

const controller = new ReportsController();

/**
 * Rotas de relatórios (TASK 3.5.6 e 3.5.7). Montado dentro do `aiRouter`,
 * portanto já assume autenticação, tenant, feature flag e plano IA validados.
 */
export const reportsRouter = Router();

reportsRouter.get('/', validate({ query: listReportsQuerySchema }), controller.list);

reportsRouter.post(
  '/on-demand',
  authorize('OWNER', 'ADMIN'),
  aiRateLimiter('report-on-demand'),
  validate(onDemandReportSchema, 'body'),
  controller.generateOnDemand,
);

reportsRouter.get('/:id', validate({ params: reportIdParamsSchema }), controller.getById);

reportsRouter.get('/:id/pdf', validate({ params: reportIdParamsSchema }), controller.getPdf);
