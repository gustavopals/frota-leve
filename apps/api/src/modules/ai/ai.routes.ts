import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { tenantMiddleware } from '../../middlewares/tenant';
import { aiFeatureFlag } from '../../middlewares/ai-feature-flag';
import { requireAI } from '../../middlewares/require-ai';
import { validate } from '../../middlewares/validate';
import { AIController } from './ai.controller';
import { usageQuerySchema } from './ai.validators';
import { chatRouter } from './chat/chat.routes';

const aiController = new AIController();

export const aiRouter = Router();

// Feature flag global → autenticação → tenant → checagem de plano IA
aiRouter.use(aiFeatureFlag, authenticate, tenantMiddleware, requireAI);

aiRouter.get(
  '/usage',
  authorize('OWNER', 'ADMIN'),
  validate({ query: usageQuerySchema }),
  aiController.getUsage,
);

aiRouter.get('/quota', authorize('OWNER', 'ADMIN'), aiController.getQuota);

// Sub-router de chat (assistente conversacional).
// Permitido para qualquer role autenticada do tenant — limites são por sessão/usuário.
aiRouter.use('/chat', chatRouter);
