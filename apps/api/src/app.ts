import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { requestId } from './middlewares/request-id';
import { errorHandler } from './middlewares/error-handler';
import { rateLimiter } from './middlewares/rate-limiter';
import { authRouter } from './modules/auth/auth.routes';
import { healthRouter } from './modules/health/health.routes';
import { vehiclesRouter } from './modules/vehicles/vehicles.routes';
import { logger } from './config/logger';
import { env } from './config/env';
import { NotFoundError } from './shared/errors';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');

  // Segurança: headers HTTP adequados
  app.use(helmet());

  // CORS — apenas frontend autorizado em produção
  app.use(
    cors({
      origin: env.NODE_ENV === 'production' ? env.FRONTEND_URL : true,
      credentials: true,
    }),
  );

  // Compressão gzip/deflate das respostas
  app.use(compression());

  // Request ID — deve vir antes do morgan para estar disponível nos logs
  app.use(requestId);

  // Rate limit global — implementação real será conectada ao Redis na TASK 0.3
  app.use(rateLimiter);

  // Logging HTTP — pula rota de health para não poluir os logs
  app.use(
    morgan('combined', {
      stream: { write: (msg: string) => logger.info(msg.trim()) },
      skip: (req: Request) => req.url === '/api/v1/health',
    }),
  );

  // Body parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ─── Rotas ────────────────────────────────────────────────────────────────
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/vehicles', vehiclesRouter);

  // TODO: demais rotas serão registradas aqui conforme as tasks avançam

  // ─── 404 ─────────────────────────────────────────────────────────────────
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError('Rota não encontrada'));
  });

  // ─── Error handler global (DEVE ser o último middleware) ──────────────────
  app.use(errorHandler);

  return app;
}
