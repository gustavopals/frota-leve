import { Router } from 'express';
import { aiRateLimiter } from '../../../middlewares/ai-rate-limiter';
import { validate } from '../../../middlewares/validate';
import { ChatController } from './chat.controller';
import {
  createSessionSchema,
  listSessionsQuerySchema,
  sendMessageSchema,
  sessionIdParamsSchema,
} from './chat.validators';

const controller = new ChatController();

/**
 * Rotas de chat. Exporta um router que deve ser montado dentro do `aiRouter`,
 * portanto já assume autenticação, tenant, feature flag e plano IA validados.
 */
export const chatRouter = Router();

chatRouter.post('/sessions', validate(createSessionSchema, 'body'), controller.createSession);

chatRouter.get('/sessions', validate({ query: listSessionsQuerySchema }), controller.listSessions);

chatRouter.get(
  '/sessions/:id/messages',
  validate({ params: sessionIdParamsSchema }),
  controller.getSessionMessages,
);

chatRouter.delete(
  '/sessions/:id',
  validate({ params: sessionIdParamsSchema }),
  controller.archiveSession,
);

chatRouter.post(
  '/sessions/:id/messages',
  aiRateLimiter('chat'),
  validate({ params: sessionIdParamsSchema, body: sendMessageSchema }),
  controller.sendMessage,
);
