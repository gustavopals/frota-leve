import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/app-error';
import { logger } from '../config/logger';

/**
 * Middleware global de tratamento de erros.
 * Deve ser o ÚLTIMO middleware registrado no Express.
 * Formata todos os erros em resposta JSON padronizada.
 */
export function errorHandler(error: Error, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId ?? 'unknown';

  if (error instanceof AppError) {
    logger.warn(`[${requestId}] ${error.code}: ${error.message}`, {
      correlationId: requestId,
      statusCode: error.statusCode,
      ...(error.details ? { details: error.details } : {}),
    });

    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  // Erro inesperado — logar stack trace completo
  logger.error(`[${requestId}] Erro inesperado`, {
    correlationId: requestId,
    error: error.message,
    stack: error.stack,
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Erro interno do servidor',
    },
  });
}
