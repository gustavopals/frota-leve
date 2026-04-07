import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const composeFile = path.join(repoRoot, 'docker-compose.yml');
const managedServices = ['postgres', 'redis'];
const command = process.argv[2] ?? 'help';

function print(message) {
  process.stdout.write(`${message}\n`);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function resolveComposeCommand() {
  const dockerComposePlugin = spawnSync('docker', ['compose', 'version'], {
    cwd: repoRoot,
    stdio: 'ignore',
  });

  if (dockerComposePlugin.status === 0) {
    return ['docker', 'compose'];
  }

  const dockerComposeBinary = spawnSync('docker-compose', ['version'], {
    cwd: repoRoot,
    stdio: 'ignore',
  });

  if (dockerComposeBinary.status === 0) {
    return ['docker-compose'];
  }

  fail('Docker Compose não encontrado. Instale Docker Desktop ou docker-compose.');
}

function runCompose(extraArgs, options = {}) {
  const [commandName, ...baseArgs] = resolveComposeCommand();
  const result = spawnSync(commandName, [...baseArgs, '-f', composeFile, ...extraArgs], {
    cwd: repoRoot,
    stdio: 'inherit',
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function keepServicesAlive() {
  print('Serviços locais iniciados. Pressione Ctrl+C para parar postgres e redis.');

  const stopServices = () => {
    print('\nEncerrando serviços locais...');
    runCompose(['stop', ...managedServices]);
    process.exit(0);
  };

  process.on('SIGINT', stopServices);
  process.on('SIGTERM', stopServices);

  setInterval(() => {
    // Mantém o processo vivo para o `turbo run dev`.
  }, 60_000);
}

function streamLogs() {
  const [commandName, ...baseArgs] = resolveComposeCommand();
  const child = spawn(
    commandName,
    [...baseArgs, '-f', composeFile, 'logs', '-f', ...managedServices],
    {
      cwd: repoRoot,
      stdio: 'inherit',
    },
  );

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

function main() {
  switch (command) {
    case 'check':
      resolveComposeCommand();
      print(`Docker Compose disponível. Arquivo encontrado em ${composeFile}.`);
      return;
    case 'up':
      runCompose(['up', '-d', ...managedServices]);
      return;
    case 'down':
      runCompose(['down']);
      return;
    case 'logs':
      streamLogs();
      return;
    case 'dev':
      runCompose(['up', '-d', ...managedServices]);
      keepServicesAlive();
      return;
    default:
      print('Uso: node ./scripts/services.mjs <check|up|down|logs|dev>');
  }
}

main();
