#!/bin/sh
set -eu

echo "[api] aguardando PostgreSQL ficar disponível..."
node - <<'NODE'
const { URL } = require('node:url');
const net = require('node:net');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL não definida');
  process.exit(1);
}

const { hostname, port } = new URL(databaseUrl);
const targetPort = Number(port || 5432);
const maxAttempts = 30;
let attempts = 0;

const tryConnect = () => {
  attempts += 1;

  const socket = net.createConnection({ host: hostname, port: targetPort });
  socket.setTimeout(3000);

  socket.on('connect', () => {
    socket.end();
    process.exit(0);
  });

  const retry = () => {
    socket.destroy();

    if (attempts >= maxAttempts) {
      console.error(`[api] PostgreSQL indisponível em ${hostname}:${targetPort} após ${maxAttempts} tentativas.`);
      process.exit(1);
    }

    process.stdout.write(`[api] tentativa ${attempts}/${maxAttempts} falhou, tentando novamente...\n`);
    setTimeout(tryConnect, 2000);
  };

  socket.on('error', retry);
  socket.on('timeout', retry);
};

tryConnect();
NODE

echo "[api] aplicando migrations do Prisma..."
cd /app/packages/database
npx prisma migrate deploy --schema ./prisma/schema.prisma

echo "[api] iniciando servidor..."
cd /app/apps/api
exec node dist/server.js
