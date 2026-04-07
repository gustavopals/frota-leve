import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import './config/load-env';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';

const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
const shutdownTimeoutMs = 10000;

const app = createApp();
const server = createServer(app);

let isShuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  logger.info(`Sinal ${signal} recebido. Iniciando graceful shutdown.`);

  const forceShutdownTimer = setTimeout(() => {
    logger.error('Graceful shutdown excedeu o tempo limite. Encerrando processo.');
    process.exit(1);
  }, shutdownTimeoutMs);

  forceShutdownTimer.unref();

  server.close((error) => {
    clearTimeout(forceShutdownTimer);

    if (error) {
      logger.error('Falha ao encerrar o servidor HTTP.', { error: error.message });
      process.exit(1);
      return;
    }

    logger.info('Servidor HTTP encerrado com sucesso.');
    process.exit(0);
  });
}

server.listen(env.PORT, () => {
  const address = server.address() as AddressInfo | null;

  logger.info('API iniciada com sucesso.', {
    port: address?.port ?? env.PORT,
    environment: env.NODE_ENV,
  });
});

for (const signal of shutdownSignals) {
  process.on(signal, () => shutdown(signal));
}
