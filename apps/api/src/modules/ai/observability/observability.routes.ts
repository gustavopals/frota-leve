import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { aiMetricsRegistry } from './ai-metrics';

/**
 * Exposição Prometheus (TASK 3.9.1).
 *
 * Montado fora do `aiRouter`: o scraper não tem sessão nem tenant, e o endpoint
 * não devolve dado de negócio — só contadores agregados do processo.
 */
export const metricsRouter = Router();

metricsRouter.get('/', (_req: Request, res: Response, next: NextFunction): void => {
  void aiMetricsRegistry
    .metrics()
    .then((body) => {
      res.setHeader('Content-Type', aiMetricsRegistry.contentType);
      res.status(200).send(body);
    })
    .catch(next);
});
