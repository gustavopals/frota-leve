import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { loadRootEnv, packageRoot } from './env.mjs';

const env = loadRootEnv();
env.CHECKPOINT_DISABLE = '1';
env.PRISMA_HIDE_UPDATE_MESSAGE = 'true';

const result = spawnSync('npx', ['tsx', 'prisma/seed.ts'], {
  cwd: packageRoot,
  stdio: 'inherit',
  env,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
