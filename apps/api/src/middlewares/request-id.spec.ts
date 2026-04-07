import request from 'supertest';
import { createApp } from '../app';

describe('requestId middleware', () => {
  it('deve gerar um X-Request-Id automaticamente', async () => {
    const response = await request(createApp()).get('/rota-inexistente');

    expect(response.status).toBe(404);
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Rota não encontrada',
      },
    });
  });

  it('deve reutilizar o X-Request-Id informado pelo cliente', async () => {
    const response = await request(createApp())
      .get('/rota-inexistente')
      .set('X-Request-Id', 'custom-request-id');

    expect(response.status).toBe(404);
    expect(response.headers['x-request-id']).toBe('custom-request-id');
  });
});
