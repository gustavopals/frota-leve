import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../shared/errors';
import {
  aiSettingsService,
  type AiToggleableFeature,
} from '../modules/ai/settings/ai-settings.service';

/**
 * Bloqueia a rota quando o OWNER desligou a feature no painel (TASK 3.8.2).
 *
 * Complementa — não substitui — o `requireAI`, que checa o plano do tenant:
 * aqui a checagem é sobre a escolha do cliente, não sobre o que ele contratou.
 */
export function aiFeatureToggle(feature: AiToggleableFeature) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      next(new UnauthorizedError('Tenant não identificado'));
      return;
    }

    void aiSettingsService
      .isFeatureEnabled(req.tenant.id, feature)
      .then((enabled) => {
        if (!enabled) {
          next(new ForbiddenError('Esta funcionalidade de IA está desativada para o seu tenant'));
          return;
        }

        next();
      })
      .catch(next);
  };
}
