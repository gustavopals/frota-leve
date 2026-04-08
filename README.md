# Frota Leve (Frotafy)

Plataforma SaaS multi-tenant de gestão de frotas para empresas brasileiras.

## Status Atual

As tasks `0.1` até `0.5.5` da Fase 0 estão implementadas no repositório.

- `apps/api`: backend Express funcional, com health check, middlewares base, testes e OpenAPI inicial
- `packages/database`: Prisma, migration inicial, seed e serviços locais de PostgreSQL + Redis
- `apps/web`: frontend Angular 21 + PO-UI 21 com shell inicial, autenticação base e lazy loading
- `CI/CD`: workflows de validação contínua, Dockerfiles de produção e `docker-compose.prod.yml`
- `apps/mobile`: ainda placeholder das próximas tasks

## Pré-requisitos

- **Node.js** >= 20.x
- **npm** >= 10.x
- **Docker** e **Docker Compose** (para PostgreSQL e Redis locais)

## Setup Inicial do Backend

```bash
# 1. Clone o repositório
git clone <repo-url>
cd frota-leve

# 2. Instale as dependências do monorepo
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com seus valores

# 4. Suba PostgreSQL e Redis locais
npm run services:up

# 5. Rode a migration inicial e o seed
npm run db:migrate -- --name init
npm run db:seed

# 6. Inicie a API + serviços locais em modo desenvolvimento
npm run dev:backend
```

## Endpoints e Documentação

```bash
# Health check
curl http://localhost:3000/api/v1/health
```

- Especificação OpenAPI inicial: [docs/openapi/api.yaml](./docs/openapi/api.yaml)
- Prisma inicial em `packages/database/prisma/schema.prisma`
- Deploy e CI/CD: [docs/deployment.md](./docs/deployment.md)

## Comandos Principais

Todos os comandos abaixo devem ser executados na raiz do monorepo.

```bash
# Desenvolvimento de todos os workspaces ativos
npm run dev

# Desenvolvimento do backend com PostgreSQL + Redis locais
npm run dev:backend

# Subir apenas PostgreSQL + Redis
npm run services:up

# Derrubar serviços locais
npm run services:down

# Acompanhar logs de PostgreSQL + Redis
npm run services:logs

# Rodar migration de desenvolvimento
npm run db:migrate -- --name nome_da_migration

# Popular o banco com dados de desenvolvimento
npm run db:seed

# Resetar banco local e reaplicar seed
npm run db:reset

# Abrir Prisma Studio
npm run db:studio

# Build de todos os packages e apps
npm run build

# Testes de todos os packages e apps
npm run test

# Lint em todo o monorepo
npm run lint

# Type-check em todo o monorepo
npm run type-check

# Formatar código com Prettier
npm run format
```

## Estrutura do Monorepo

```
frota-leve/
├── apps/
│   ├── api/          # Backend Node.js + Express + Prisma (TASK 0.2)
│   ├── web/          # Frontend Angular 21 + PO-UI 21 (TASK 0.4)
│   └── mobile/       # PWA Angular para motoristas (TASK 4.1)
├── packages/
│   ├── shared/       # Tipos, DTOs, validações, constantes e utils
│   ├── database/     # Prisma schema, migrations, seeds (TASK 0.3)
│   └── ai/           # Integração de IA (TASK 3.1)
├── docs/             # Documentação técnica
├── tools/            # Scripts de automação
└── .github/
    └── workflows/    # CI/CD GitHub Actions (TASK 0.5)
```

## Desenvolvimento por Módulo

```bash
# Rodar apenas a API
npm run dev --workspace=apps/api

# Rodar apenas o frontend
npm run dev --workspace=apps/web

# Testar apenas o package shared
npm test --workspace=packages/shared

# Lint apenas no backend
npm run lint --workspace=apps/api
```

## Banco de Dados (Prisma)

```bash
# Subir PostgreSQL + Redis
npm run services:up

# Aplicar migration de desenvolvimento
npm run db:migrate -- --name init

# Rodar seed
npm run db:seed

# Resetar o banco local e executar seed novamente
npm run db:reset

# Abrir Prisma Studio
npm run db:studio
```

## Produção

Os artefatos de produção estão versionados e prontos para uso:

- `apps/api/Dockerfile`
- `apps/web/Dockerfile`
- `apps/web/nginx/default.conf`
- `docker-compose.prod.yml`
- `.env.prod.example`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`

O passo a passo de bootstrap do servidor, secrets do GitHub e estratégia de deploy está em [docs/deployment.md](./docs/deployment.md).

## Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha os valores. Veja comentários no arquivo para instruções de cada variável.

## Convenções

- **TypeScript strict** em todo o monorepo
- **Conventional Commits**: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`
- **Multi-tenancy**: todo endpoint deve ser escopado por `tenantId`
- **Idioma**: comentários de negócio em PT-BR, infraestrutura em inglês
- Detalhes em [CLAUDE.md](./CLAUDE.md) e [ROADMAP.MD](./ROADMAP.MD)
