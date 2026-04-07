# Deploy de Produção

O projeto usa Docker Compose em produção, com imagens publicadas no Docker Hub e deploy automatizado via GitHub Actions por SSH.

## Artefatos versionados

- `apps/api/Dockerfile`: build multi-stage da API Node.js
- `apps/web/Dockerfile`: build Angular 21 e runtime em Nginx Alpine
- `apps/web/nginx/default.conf`: reverse proxy `/api`, SPA fallback, gzip e cache
- `docker-compose.prod.yml`: orquestração de `web`, `api`, `postgres` e `redis`
- `.env.prod.example`: template do ambiente de produção
- `.github/workflows/ci.yml`: validação contínua do monorepo
- `.github/workflows/deploy.yml`: publish das imagens e rollout no servidor

## Bootstrap do servidor

Pré-requisitos:

- Docker Engine 27+ com plugin `docker compose`
- pasta de deploy persistente, por exemplo `/opt/frota-leve`
- acesso SSH com chave privada a partir do GitHub Actions

Passos iniciais no servidor:

```bash
mkdir -p /opt/frota-leve
cd /opt/frota-leve
cp .env.prod.example .env.prod
# Edite o .env.prod com os valores reais
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d postgres redis
```

Observação: o workflow de deploy sempre reenvia `docker-compose.prod.yml` e `.env.prod.example`, mas não sobrescreve `.env.prod`.
Use sempre `docker compose --env-file .env.prod -f docker-compose.prod.yml ...`, porque os valores de `.env.prod` participam tanto da interpolação do compose quanto das variáveis entregues aos containers.

## Variáveis de produção

Use `.env.prod.example` como base e preencha ao menos:

- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `FRONTEND_URL`
- `API_IMAGE` e `WEB_IMAGE` apenas como fallback; o deploy injeta tags imutáveis por SHA

## Segredos do GitHub Actions

Configure estes secrets no repositório:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `DEPLOY_HOST`
- `DEPLOY_PORT` (opcional, padrão `22`)
- `DEPLOY_USER`
- `DEPLOY_PATH`
- `DEPLOY_SSH_KEY`

## Fluxo de CI

O workflow `CI` roda em `push` e `pull_request` com os jobs:

- `lint`: `prettier --check` + `eslint`
- `type-check`: `tsc --noEmit` via `turbo`
- `test`: testes unitários e e2e da API
- `build`: compilação de todos os workspaces
- `docker`: build das imagens e validação do `docker-compose.prod.yml`

## Fluxo de deploy

O workflow `Deploy Production` roda em `push` na branch `main` e também suporta `workflow_dispatch`.

Sequência:

1. gera tags `sha-<commit>` e `latest` para `api` e `web`
2. publica ambas as imagens no Docker Hub
3. envia `docker-compose.prod.yml` e `.env.prod.example` para o servidor
4. executa `docker compose pull` e `docker compose up -d` com as tags do commit

## Branch protection

Essa parte não é versionável pelo código do repositório. Configure manualmente no GitHub:

1. exigir pull request para merge na `main`
2. exigir aprovação mínima de 1 reviewer
3. exigir status checks do workflow `CI`
