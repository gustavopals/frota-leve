import { HealthService } from './health.service';

describe('HealthService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('deve retornar o status básico da aplicação', () => {
    jest.spyOn(process, 'uptime').mockReturnValue(128.4);

    const service = new HealthService();
    const status = service.check();

    expect(status).toEqual({
      status: 'ok',
      timestamp: expect.any(String),
      version: expect.any(String),
      uptime: 128,
    });
    expect(Number.isNaN(Date.parse(status.timestamp))).toBe(false);
  });
});
