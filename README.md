# Frota Leve (Frotafy)

Plataforma SaaS multi-tenant de gestão de frotas para empresas brasileiras.

## Status Atual

O monorepo base e o backend Express da Fase 0 estão prontos.

- `apps/api`: funcional, com health check, middlewares base, testes e OpenAPI inicial
- `packages/database`: serviços locais de PostgreSQL + Redis para desenvolvimento
- `apps/web` e `apps/mobile`: ainda são placeholders das próximas tasks

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

# 5. Inicie a API + serviços locais em modo desenvolvimento
npm run dev:backend
```

## Endpoints e Documentação

```bash
# Health check
curl http://localhost:3000/api/v1/health
```

- Especificação OpenAPI inicial: [docs/openapi/api.yaml](./docs/openapi/api.yaml)
- O setup de Prisma, migrations e seeds será concluído na `TASK 0.3`

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
│   ├── web/          # Frontend Angular 18 + PO-UI (TASK 0.4)
│   └── mobile/       # PWA Angular para motoristas (TASK 4.1)
├── packages/
│   ├── shared/       # Tipos, DTOs, validações, constantes e utils
│   ├── database/     # Prisma schema, migrations, seeds (TASK 0.3)
│   └── ai/           # Integração Claude API (TASK 3.1)
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

O package `packages/database` já sobe PostgreSQL e Redis locais para desenvolvimento.
O schema Prisma, migrations e seeds serão adicionados na `TASK 0.3`.

## Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha os valores. Veja comentários no arquivo para instruções de cada variável.

## Convenções

- **TypeScript strict** em todo o monorepo
- **Conventional Commits**: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`
- **Multi-tenancy**: todo endpoint deve ser escopado por `tenantId`
- **Idioma**: comentários de negócio em PT-BR, infraestrutura em inglês
- Detalhes em [CLAUDE.md](./CLAUDE.md) e [ROADMAP.MD](./ROADMAP.MD)
