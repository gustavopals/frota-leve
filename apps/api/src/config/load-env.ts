import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const repoRoot = path.resolve(__dirname, '../../../../');
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
