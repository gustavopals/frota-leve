// Setup do ambiente de testes — define env vars mínimas para evitar crash no boot
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3001';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/frota_leve_test';
process.env['REDIS_URL'] = 'redis://localhost:6379';
process.env['JWT_SECRET'] = 'test-secret-para-jest-com-pelo-menos-32-caracteres-ok';
process.env['JWT_REFRESH_SECRET'] = 'test-refresh-secret-para-jest-com-32-chars-ok-!!';
process.env['FRONTEND_URL'] = 'http://localhost:4200';
