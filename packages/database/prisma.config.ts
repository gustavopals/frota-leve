import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node ./scripts/run-seed.mjs',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
