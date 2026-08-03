import { Router } from 'express';
import { authorize } from '../../../middlewares/auth';
import { validate } from '../../../middlewares/validate';
import { AnomalyController } from './anomaly.controller';
import { anomalyIdParamsSchema, listAnomaliesQuerySchema } from './anomaly.validators';

const controller = new AnomalyController();

/**
 * Rotas de anomalias (TASK 3.4.5). Montado dentro do `aiRouter`, portanto já
 * assume autenticação, tenant, feature flag e plano IA validados.
 *
 * Leitura é liberada para qualquer role do tenant; mudar o status de um alerta
 * fica restrito a quem responde pela frota.
 */
export const anomalyRouter = Router();

anomalyRouter.get('/', validate({ query: listAnomaliesQuerySchema }), controller.list);

anomalyRouter.get('/insights', controller.listInsights);

anomalyRouter.get(
  '/vehicle/:id',
  validate({ params: anomalyIdParamsSchema }),
  controller.getVehicleAnalysis,
);

anomalyRouter.post(
  '/:id/acknowledge',
  authorize('OWNER', 'ADMIN', 'MANAGER'),
  validate({ params: anomalyIdParamsSchema }),
  controller.acknowledge,
);

anomalyRouter.post(
  '/:id/dismiss',
  authorize('OWNER', 'ADMIN', 'MANAGER'),
  validate({ params: anomalyIdParamsSchema }),
  controller.dismiss,
);
