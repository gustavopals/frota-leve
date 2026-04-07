import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { errorHandler } from './error-handler';
import { validate } from './validate';

function createValidationTestApp() {
  const app = express();

  app.use(express.json());

  app.post(
    '/single',
    validate(
      z.object({
        page: z.coerce.number().int().positive().default(1),
      }),
    ),
    (req, res) => {
      res.status(200).json({ body: req.body });
    },
  );

  app.post(
    '/multi/:id',
    validate({
      params: z.object({
        id: z.coerce.number().int().positive(),
      }),
      query: z.object({
        page: z.coerce.number().int().positive().default(1),
      }),
      body: z.object({
        active: z.boolean(),
      }),
    }),
    (req, res) => {
      res.status(200).json({
        body: req.body,
        params: req.params,
        query: req.query,
      });
    },
  );

  app.use(errorHandler);

  return app;
}

describe('validate middleware', () => {
  it('deve validar e normalizar um único alvo', async () => {
    const response = await request(createValidationTestApp()).post('/single').send({ page: '2' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      body: {
        page: 2,
      },
    });
  });

  it('deve retornar erro padronizado quando o body for inválido', async () => {
    const response = await request(createValidationTestApp()).post('/single').send({ page: '0' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        details: {
          page: ['Number must be greater than 0'],
        },
      },
    });
  });

  it('deve validar body, params e query na mesma chamada', async () => {
    const response = await request(createValidationTestApp())
      .post('/multi/42?page=3')
      .send({ active: true });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      body: {
        active: true,
      },
      params: {
        id: 42,
      },
      query: {
        page: 3,
      },
    });
  });

  it('deve agrupar erros por alvo quando múltiplas validações falharem', async () => {
    const response = await request(createValidationTestApp())
      .post('/multi/abc?page=0')
      .send({ active: 'sim' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        details: {
          body: {
            active: ['Expected boolean, received string'],
          },
          params: {
            id: ['Expected number, received nan'],
          },
          query: {
            page: ['Number must be greater than 0'],
          },
        },
      },
    });
  });
});
