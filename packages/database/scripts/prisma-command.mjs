import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { loadRootEnv, packageRoot, schemaPath } from './env.mjs';

const args = process.argv.slice(2);

if (args.length === 0) {
  process.stderr.write('Uso: node ./scripts/prisma-command.mjs <comando prisma>\n');
  process.exit(1);
}

const env = loadRootEnv();
env.CHECKPOINT_DISABLE = '1';
env.PRISMA_HIDE_UPDATE_MESSAGE = 'true';

const result = spawnSync('npx', ['prisma', ...args, '--schema', schemaPath], {
  cwd: packageRoot,
  stdio: 'inherit',
  env,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
