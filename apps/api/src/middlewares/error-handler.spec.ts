import express from 'express';
import request from 'supertest';
import { errorHandler } from './error-handler';
import { requestId } from './request-id';
import { ValidationError } from '../shared/errors';

function createErrorTestApp() {
  const app = express();

  app.use(requestId);

  app.get('/validation-error', (_req, _res, next) => {
    next(new ValidationError('Dados inválidos', { body: { plate: ['Obrigatório'] } }));
  });

  app.get('/unexpected-error', () => {
    throw new Error('falha inesperada');
  });

  app.use(errorHandler);

  return app;
}

describe('errorHandler middleware', () => {
  it('deve formatar AppError em JSON padronizado', async () => {
    const response = await request(createErrorTestApp()).get('/validation-error');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        details: {
          body: {
            plate: ['Obrigatório'],
          },
        },
      },
    });
  });

  it('deve esconder detalhes de erros inesperados', async () => {
    const response = await request(createErrorTestApp()).get('/unexpected-error');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Erro interno do servidor',
      },
    });
  });
});
