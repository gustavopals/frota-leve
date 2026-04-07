import request from 'supertest';
import { createApp } from '../../app';

describe('GET /api/v1/health', () => {
  it('deve responder com status ok e payload sem envelope', async () => {
    const response = await request(createApp()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
    expect(response.body).toEqual({
      status: 'ok',
      timestamp: expect.any(String),
      version: expect.any(String),
      uptime: expect.any(Number),
    });
  });
});
