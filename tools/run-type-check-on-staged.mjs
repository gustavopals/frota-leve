import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const fullCheckTriggers = new Set([
  '.eslintrc.js',
  '.husky/pre-commit',
  '.prettierrc',
  'package-lock.json',
  'package.json',
  'tsconfig.base.json',
  'turbo.json',
]);

function print(message) {
  process.stdout.write(`${message}\n`);
}

function getStagedFiles() {
  const output = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  return output
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean);
}

function getWorkspaceName(workspaceDir) {
  const packageJsonPath = path.join(repoRoot, workspaceDir, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

  return packageJson.name;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    print('No staged files detected. Skipping staged type-check.');
    return;
  }

  if (
    stagedFiles.some(
      (file) =>
        fullCheckTriggers.has(file) || file.startsWith('.husky/') || file.startsWith('tools/'),
    )
  ) {
    print('Running full type-check because shared tooling files changed.');
    run('npm', ['run', 'type-check']);
    return;
  }

  const workspaceDirs = new Set();

  for (const file of stagedFiles) {
    const segments = file.split('/');

    if (segments.length < 2) {
      continue;
    }

    if (segments[0] !== 'apps' && segments[0] !== 'packages') {
      continue;
    }

    workspaceDirs.add(`${segments[0]}/${segments[1]}`);
  }

  if (workspaceDirs.size === 0) {
    print('No staged workspace files require type-check. Skipping.');
    return;
  }

  const filters = [...workspaceDirs]
    .sort()
    .flatMap((workspaceDir) => ['--filter', getWorkspaceName(workspaceDir)]);

  print(`Running staged type-check for: ${[...workspaceDirs].sort().join(', ')}`);
  run('npx', ['turbo', 'run', 'type-check', ...filters]);
}

main();
