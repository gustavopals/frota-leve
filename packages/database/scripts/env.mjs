import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const packageRoot = path.resolve(scriptDir, '..');
export const repoRoot = path.resolve(packageRoot, '../..');
export const schemaPath = path.join(packageRoot, 'prisma', 'schema.prisma');

export function loadRootEnv() {
  const envFiles = [path.join(repoRoot, '.env'), path.join(repoRoot, '.env.example')];

  for (const envFile of envFiles) {
    if (!fs.existsSync(envFile)) {
      continue;
    }

    dotenv.config({
      path: envFile,
      override: false,
    });
  }

  return process.env;
}
