import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../../middlewares/validate';
import { UnauthorizedError } from '../../../shared/errors';
import { driverScoringService } from './driver-scoring.service';
import type { NextFunction, Request, Response } from 'express';

const driverIdParamsSchema = z.object({ id: z.uuid('ID do motorista inválido') }).strict();

const rankingQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

function getTenantId(req: Request): string {
  if (!req.tenant) {
    throw new UnauthorizedError('Tenant não identificado');
  }

  return req.tenant.id;
}

/**
 * Rotas de scoring (TASK 3.7.4). Montado dentro do `aiRouter`, portanto já
 * assume autenticação, tenant, feature flag e plano IA validados.
 */
export const scoringRouter = Router();

scoringRouter.get(
  '/ranking',
  validate({ query: rankingQuerySchema }),
  (req: Request, res: Response, next: NextFunction): void => {
    void driverScoringService
      .getRanking(getTenantId(req), req.query as unknown as z.infer<typeof rankingQuerySchema>)
      .then((result) => res.status(200).json({ success: true, ...result }))
      .catch(next);
  },
);

scoringRouter.get(
  '/drivers/:id',
  validate({ params: driverIdParamsSchema }),
  (req: Request, res: Response, next: NextFunction): void => {
    void driverScoringService
      .getHistory(getTenantId(req), req.params['id'] as string)
      .then((data) => res.status(200).json({ success: true, data }))
      .catch(next);
  },
);
