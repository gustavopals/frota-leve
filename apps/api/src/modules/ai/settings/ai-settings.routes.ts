import { AIFeature, AIUsageStatus } from '@frota-leve/database';
import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { authorize } from '../../../middlewares/auth';
import { validate } from '../../../middlewares/validate';
import { UnauthorizedError } from '../../../shared/errors';
import { AI_TOGGLEABLE_FEATURES, aiSettingsService } from './ai-settings.service';

const featureFlagsSchema = z
  .object(
    Object.fromEntries(
      AI_TOGGLEABLE_FEATURES.map((feature) => [feature, z.boolean().optional()]),
    ) as Record<(typeof AI_TOGGLEABLE_FEATURES)[number], z.ZodOptional<z.ZodBoolean>>,
  )
  .strict();

const updateSettingsSchema = z
  .object({
    features: featureFlagsSchema.optional(),
    reportRecipients: z.array(z.email('E-mail inválido')).max(20).optional(),
    anomalyRecipients: z.array(z.email('E-mail inválido')).max(20).optional(),
  })
  .strict();

const usageLogsQuerySchema = z
  .object({
    feature: z.nativeEnum(AIFeature).optional(),
    status: z.nativeEnum(AIUsageStatus).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

function getTenantId(req: Request): string {
  if (!req.tenant) {
    throw new UnauthorizedError('Tenant não identificado');
  }

  return req.tenant.id;
}

/**
 * Painel administrativo de IA (TASK 3.8). Restrito a OWNER — é onde se desliga
 * feature e se audita gasto, então não é leitura de operação.
 */
export const aiSettingsRouter = Router();

aiSettingsRouter.use(authorize('OWNER'));

aiSettingsRouter.get('/', (req: Request, res: Response, next: NextFunction): void => {
  void aiSettingsService
    .get(getTenantId(req))
    .then((data) => res.status(200).json({ success: true, data }))
    .catch(next);
});

aiSettingsRouter.patch(
  '/',
  validate(updateSettingsSchema, 'body'),
  (req: Request, res: Response, next: NextFunction): void => {
    void aiSettingsService
      .update(getTenantId(req), req.body as z.infer<typeof updateSettingsSchema>)
      .then((data) => res.status(200).json({ success: true, data }))
      .catch(next);
  },
);

aiSettingsRouter.get('/usage-overview', (req: Request, res: Response, next: NextFunction): void => {
  void aiSettingsService
    .getUsageOverview(getTenantId(req))
    .then((data) => res.status(200).json({ success: true, data }))
    .catch(next);
});

aiSettingsRouter.get(
  '/logs',
  validate({ query: usageLogsQuerySchema }),
  (req: Request, res: Response, next: NextFunction): void => {
    void aiSettingsService
      .listUsageLogs(getTenantId(req), req.query as unknown as z.infer<typeof usageLogsQuerySchema>)
      .then((result) => res.status(200).json({ success: true, ...result }))
      .catch(next);
  },
);
