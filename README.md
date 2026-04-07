# Frota Leve (Frotafy)

Plataforma SaaS multi-tenant de gestão de frotas para empresas brasileiras.

## Pré-requisitos

- **Node.js** >= 20.x
- **npm** >= 10.x
- **Docker** e **Docker Compose** (para PostgreSQL e Redis locais)

## Setup Inicial

```bash
# 1. Clone o repositório
git clone <repo-url>
cd frota-leve

# 2. Instale as dependências do monorepo
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com seus valores

# 4. Suba os containers do banco e redis
docker-compose up -d

# 5. Execute as migrations do banco
cd packages/database
npx prisma migrate dev
cd ../..

# 6. Popule o banco com dados de desenvolvimento
cd packages/database
npx ts-node seed.ts
cd ../..
```

## Comandos Principais

Todos os comandos abaixo devem ser executados na raiz do monorepo.

```bash
# Desenvolvimento (sobe API + Web simultaneamente)
npm run dev

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

```bash
# Criar nova migration
cd packages/database
npx prisma migrate dev --name nome_da_migration

# Abrir Prisma Studio (GUI)
npx prisma studio

# Resetar banco (apenas DEV!)
npx prisma migrate reset
```

## Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha os valores. Veja comentários no arquivo para instruções de cada variável.

## Convenções

- **TypeScript strict** em todo o monorepo
- **Conventional Commits**: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`
- **Multi-tenancy**: todo endpoint deve ser escopado por `tenantId`
- **Idioma**: comentários de negócio em PT-BR, infraestrutura em inglês
- Detalhes em [CLAUDE.md](./CLAUDE.md) e [ROADMAP.MD](./ROADMAP.MD)
