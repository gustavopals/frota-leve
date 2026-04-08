# 🗺️ ROADMAP DE DESENVOLVIMENTO — FROTA LEVE

> **Plano de Desenvolvimento Detalhado**
> Versão: 1.0 | Abril 2026
> Referência: IDEIA.MD
> Ferramenta de Desenvolvimento: Claude Code (monorepo)
> Estimativa Total: ~20 sprints de 2 semanas (~10 meses)

---

## ÍNDICE

1. [Princípios de Desenvolvimento](#1-princípios-de-desenvolvimento)
2. [Fase 0 — Fundação e Infraestrutura](#2-fase-0--fundação-e-infraestrutura-sprints-1-3)
3. [Fase 1 — Core do Sistema (MVP)](#3-fase-1--core-do-sistema-mvp-sprints-4-8)
4. [Fase 2 — Módulos Operacionais](#4-fase-2--módulos-operacionais-sprints-9-12)
5. [Fase 3 — Inteligência Artificial](#5-fase-3--inteligência-artificial-sprints-13-15)
6. [Fase 4 — App Mobile e Experiência do Motorista](#6-fase-4--app-mobile-e-experiência-do-motorista-sprints-16-17)
7. [Fase 5 — Billing, Onboarding e Go-to-Market](#7-fase-5--billing-onboarding-e-go-to-market-sprints-18-19)
8. [Fase 6 — Polish, Testes e Lançamento](#8-fase-6--polish-testes-e-lançamento-sprint-20)
9. [Pós-Lançamento — Evolução Contínua](#9-pós-lançamento--evolução-contínua)
10. [Referência Rápida de Tasks](#10-referência-rápida-de-tasks)

---

## 1. PRINCÍPIOS DE DESENVOLVIMENTO

### 1.1 Ordem de Construção (Filosofia)

A ordem das fases foi pensada com a seguinte lógica:

```
FUNDAÇÃO → AUTENTICAÇÃO → MULTI-TENANT → CRUD CORE → MÓDULOS OPERACIONAIS → IA → MOBILE → BILLING → LANÇAMENTO
```

**Por quê essa ordem?**

1. **Fundação primeiro**: monorepo, banco, CI/CD — tudo que vem depois depende disso
2. **Auth + Multi-tenant antes de qualquer tela**: cada feature precisa saber "quem é o usuário" e "de qual empresa", então isso é pré-requisito absoluto
3. **CRUDs core (veículos, motoristas)**: são as entidades centrais que todos os módulos referenciam
4. **Módulos operacionais em sequência de dependência**: combustível depende de veículo; manutenção depende de veículo; multas dependem de veículo + motorista; financeiro depende de tudo
5. **IA depois dos dados**: a IA só faz sentido quando há dados para analisar
6. **Mobile depois do backend estável**: o app mobile consome a mesma API
7. **Billing por último antes do lançamento**: não precisa cobrar durante desenvolvimento/beta

### 1.2 Convenções para Claude Code

Ao desenvolver com Claude Code, siga estas convenções em todas as tasks:

```
- Linguagem: TypeScript strict em todo o monorepo
- Nomenclatura: camelCase para variáveis/funções, PascalCase para classes/interfaces/types, UPPER_SNAKE_CASE para constantes e enums
- Nomes de arquivo: kebab-case (ex: vehicle-list.component.ts)
- Banco: snake_case para tabelas e colunas no Prisma (@map)
- API: kebab-case para URLs (ex: /api/v1/vehicles, /api/v1/fuel-records)
- Commits: conventional commits (feat:, fix:, chore:, refactor:, docs:, test:)
- Branches: feature/TASK-ID-descricao, fix/TASK-ID-descricao
- Testes: colocar .spec.ts ao lado do arquivo testado
- Comentários: em português no código de negócio, inglês em código de infra
- Validação: zod no backend para validar DTOs; shared schemas no packages/shared
- Erros: AppError customizado com código, mensagem e HTTP status
- Logs: winston com níveis (error, warn, info, debug) e correlation ID por request
```

### 1.3 Definição de Pronto (DoD)

Uma task só está **pronta** quando:

- [ ] Código implementado e funcional
- [ ] Tipagem TypeScript sem `any` (exceto libs externas sem tipos)
- [ ] Validação de entrada com zod
- [ ] Tratamento de erros com AppError
- [ ] Testes unitários para lógica de negócio (services)
- [ ] Teste de integração para endpoints (supertest)
- [ ] Documentação Swagger do endpoint (decorators ou YAML)
- [ ] Migration do Prisma rodando sem erros
- [ ] Seed com dados de exemplo (quando aplicável)
- [ ] Code review (ou revisão via Claude Code)
- [ ] Sem warnings no build

---

## 2. FASE 0 — FUNDAÇÃO E INFRAESTRUTURA (Sprints 1-3)

> **Objetivo**: Ter o monorepo configurado, banco rodando, CI/CD funcionando e a base de código pronta para receber features.

---

### TASK 0.1 — Inicialização do Monorepo

**Descrição**: Criar a estrutura do monorepo com Turborepo, configurar workspaces e scripts base.

**Subtasks:**

- [x] **0.1.1** — Inicializar repositório Git e criar `.gitignore` completo (node_modules, dist, .env, .turbo, coverage, .angular)
- [x] **0.1.2** — Inicializar Turborepo (`npx create-turbo@latest`) com estrutura de pastas:
  ```
  frota-leve/
  ├── apps/
  │   ├── web/          # Angular + PO-UI
  │   ├── api/          # Node.js + Express
  │   └── mobile/       # Angular PWA (criado na Fase 4)
  ├── packages/
  │   ├── shared/       # Tipos, DTOs, validações, constantes
  │   ├── database/     # Prisma schema, migrations, seeds
  │   └── ai/           # Módulo Claude API (criado na Fase 3)
  ├── docs/
  ├── tools/
  └── .github/
  ```
- [x] **0.1.3** — Configurar `turbo.json` com pipelines: `build`, `dev`, `test`, `lint`, `type-check`
- [x] **0.1.4** — Configurar `tsconfig.base.json` na raiz com path aliases (`@frota-leve/shared`, `@frota-leve/database`, `@frota-leve/ai`)
- [x] **0.1.5** — Criar `packages/shared` com `package.json`, `tsconfig.json` e estrutura:
  ```
  packages/shared/
  ├── src/
  │   ├── types/         # Interfaces e types globais
  │   ├── enums/         # Enums compartilhados
  │   ├── dtos/          # DTOs com validação zod
  │   ├── constants/     # Constantes globais
  │   ├── utils/         # Funções utilitárias puras
  │   └── index.ts       # Barrel export
  ├── tsconfig.json
  └── package.json
  ```
- [x] **0.1.6** — Configurar ESLint + Prettier na raiz com config compartilhada (regras: no-any, no-unused-vars, prefer-const, consistent-return)
- [x] **0.1.7** — Configurar Husky + lint-staged para pre-commit (lint + type-check nos arquivos alterados)
- [x] **0.1.8** — Criar `README.md` com instruções de setup do projeto para novos desenvolvedores
- [x] **0.1.9** — Criar `.env.example` com todas as variáveis de ambiente documentadas

---

### TASK 0.2 — Setup do Backend (apps/api)

**Descrição**: Criar o projeto Express com TypeScript, estrutura de pastas e configurações base.

**Subtasks:**

- [x] **0.2.1** — Inicializar `apps/api` com `package.json` e dependências:
  - express, cors, helmet, compression, morgan, dotenv
  - typescript, ts-node-dev, @types/express, @types/node
  - zod, winston, uuid
- [x] **0.2.2** — Configurar `tsconfig.json` do api (paths, strict, decorators se necessário)
- [x] **0.2.3** — Criar estrutura de pastas do backend:
  ```
  apps/api/src/
  ├── config/            # Configurações (env, database, redis, etc.)
  │   ├── env.ts         # Validação de env vars com zod
  │   ├── database.ts    # Config Prisma
  │   └── logger.ts      # Winston config
  ├── middlewares/        # Middlewares Express
  │   ├── error-handler.ts
  │   ├── auth.ts
  │   ├── tenant.ts
  │   ├── rate-limiter.ts
  │   ├── request-id.ts
  │   └── validate.ts
  ├── modules/           # Módulos de domínio (feature-based)
  │   └── health/        # Primeiro módulo: health check
  │       ├── health.controller.ts
  │       ├── health.routes.ts
  │       └── health.service.ts
  ├── shared/            # Código compartilhado do backend
  │   ├── errors/        # AppError, NotFoundError, etc.
  │   ├── helpers/       # Funções auxiliares
  │   └── types/         # Types específicos do backend
  ├── app.ts             # Configuração do Express (middlewares, routes)
  └── server.ts          # Entry point (listen)
  ```
- [x] **0.2.4** — Implementar `config/env.ts`: schema zod validando todas as env vars no boot (PORT, DATABASE_URL, JWT_SECRET, REDIS_URL, CLAUDE_API_KEY, STRIPE_SECRET_KEY, etc.) — crash early se faltar algo
- [x] **0.2.5** — Implementar `config/logger.ts`: Winston com níveis, formato JSON em produção, colorido em dev, correlationId por request
- [x] **0.2.6** — Implementar `shared/errors/app-error.ts`: classe AppError com (message, statusCode, code, details) e subclasses: NotFoundError, ValidationError, UnauthorizedError, ForbiddenError, ConflictError
- [x] **0.2.7** — Implementar middleware `error-handler.ts`: catch global que formata AppError em JSON padronizado `{ success: false, error: { code, message, details } }`
- [x] **0.2.8** — Implementar middleware `request-id.ts`: gera UUID v4 por request, seta no header `X-Request-Id` e disponibiliza via `req.requestId`
- [x] **0.2.9** — Implementar middleware `validate.ts`: recebe schema zod e valida `req.body`, `req.params`, `req.query` — lança ValidationError se inválido
- [x] **0.2.10** — Implementar `app.ts`: montar Express com helmet, cors, compression, morgan, requestId, JSON body parser (limite 10mb), rotas e error handler
- [x] **0.2.11** — Implementar `server.ts`: graceful shutdown (SIGTERM, SIGINT), log de porta no boot
- [x] **0.2.12** — Implementar módulo `health`: GET `/api/v1/health` retornando `{ status: 'ok', timestamp, version, uptime }`
- [x] **0.2.13** — Configurar `ts-node-dev` para hot reload em desenvolvimento
- [x] **0.2.14** — Criar script `dev` no turbo que sobe api + banco simultaneamente

---

### TASK 0.3 — Setup do Banco de Dados (packages/database)

**Descrição**: Configurar Prisma, PostgreSQL com Docker e o schema base.

**Subtasks:**

- [x] **0.3.1** — Criar `packages/database` com Prisma instalado
- [x] **0.3.2** — Criar `docker-compose.yml` na raiz com serviços:
  - `postgres`: PostgreSQL 16 com volume persistente, porta 5432
  - `redis`: Redis 7 com porta 6379
  - `pgadmin` (opcional): para visualização em dev
- [x] **0.3.3** — Configurar `schema.prisma` com provider postgresql, schema `public` explícito e extensão pgvector habilitada (`previewFeatures = ["postgresqlExtensions"]` no Prisma 6, com `schemas = ["public"]` e `@@schema("public")`)
- [x] **0.3.4** — Criar schema base (tabelas globais no schema `public`):

  ```prisma
  // === TENANTS ===
  model Tenant {
    id            String   @id @default(uuid())
    name          String   // Razão social
    tradeName     String?  // Nome fantasia
    cnpj          String   @unique
    email         String
    phone         String?
    address       Json?    // { street, number, complement, neighborhood, city, state, zipCode }
    logoUrl       String?
    plan          PlanType @default(ESSENTIAL)
    status        TenantStatus @default(TRIAL)
    trialEndsAt   DateTime?
    stripeCustomerId    String?
    stripeSubscriptionId String?
    settings      Json?    // Configurações customizáveis do tenant
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt
    users         User[]
  }

  enum PlanType {
    ESSENTIAL
    PROFESSIONAL
    ENTERPRISE
  }

  enum TenantStatus {
    TRIAL
    ACTIVE
    SUSPENDED
    CANCELLED
  }

  // === USERS ===
  model User {
    id            String   @id @default(uuid())
    tenantId      String
    tenant        Tenant   @relation(fields: [tenantId], references: [id])
    name          String
    email         String
    passwordHash  String
    role          UserRole @default(VIEWER)
    isActive      Boolean  @default(true)
    lastLoginAt   DateTime?
    avatarUrl     String?
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt

    @@unique([tenantId, email])
  }

  enum UserRole {
    OWNER       // Dono da conta — acesso total
    ADMIN       // Administrador
    MANAGER     // Gestor de frota
    FINANCIAL   // Acesso ao financeiro
    DRIVER      // Motorista (acesso limitado ao app)
    VIEWER      // Somente visualização
  }

  // === AUDIT LOG ===
  model AuditLog {
    id          String   @id @default(uuid())
    tenantId    String
    userId      String?
    action      String   // CREATE, UPDATE, DELETE
    entity      String   // Vehicle, Driver, FuelRecord, etc.
    entityId    String
    changes     Json?    // { field: { old: x, new: y } }
    ipAddress   String?
    userAgent   String?
    createdAt   DateTime @default(now())
  }
  ```

- [x] **0.3.5** — Rodar primeira migration: `npx prisma migrate dev --name init`
- [x] **0.3.6** — Criar `seed.ts` com dados de desenvolvimento:
  - 1 tenant de demo (empresa fictícia "Transportadora Demo Ltda")
  - 1 user OWNER (admin@demo.com / senha: 123456)
  - 1 user MANAGER, 1 user DRIVER
- [x] **0.3.7** — Criar script `db:seed`, `db:reset`, `db:studio` no package.json
- [x] **0.3.8** — Exportar PrismaClient singleton configurado de `packages/database/src/client.ts`
- [x] **0.3.9** — Configurar `packages/database` como dependência do `apps/api` no workspace

---

### TASK 0.4 — Setup do Frontend (apps/web)

**Descrição**: Criar o projeto Angular com PO-UI, configuração de rotas e layout base.

**Subtasks:**

- [x] **0.4.1** — Criar projeto Angular via CLI: `ng new web --style=scss --routing --strict`
- [x] **0.4.2** — Instalar PO-UI: `ng add @po-ui/ng-components` e `@po-ui/ng-templates`
- [x] **0.4.3** — Configurar `angular.json`: assets, styles (PO-UI theme), budget de build
- [x] **0.4.4** — Configurar path aliases no `tsconfig.json` para `@frota-leve/shared`
- [x] **0.4.5** — Criar estrutura de pastas do frontend:
  ```
  apps/web/src/app/
  ├── core/                    # Singletons, guards, interceptors
  │   ├── guards/
  │   │   ├── auth-guard.ts        # CanActivateFn funcional
  │   │   └── role-guard.ts        # CanActivateFn funcional
  │   ├── interceptors/
  │   │   ├── auth-interceptor.ts  # HttpInterceptorFn funcional
  │   │   ├── error-interceptor.ts # HttpInterceptorFn funcional
  │   │   └── tenant-interceptor.ts # HttpInterceptorFn funcional
  │   └── services/
  │       ├── auth.ts
  │       ├── api.ts               # HttpClient wrapper com base URL
  │       ├── notification.ts
  │       └── storage.ts
  ├── shared/                   # Componentes e pipes reutilizáveis
  │   ├── components/
  │   ├── pipes/
  │   └── directives/
  ├── layout/                   # Shell da aplicação
  │   ├── main-layout/          # Layout com menu lateral PO-UI (standalone)
  │   └── auth-layout/          # Layout para login/registro (standalone)
  ├── features/                 # Features standalone (lazy loaded via routes)
  │   ├── auth/                 # Login, registro, forgot password
  │   ├── dashboard/            # Dashboard principal
  │   ├── vehicles/             # CRUD de veículos
  │   ├── drivers/              # CRUD de motoristas
  │   ├── fuel/                 # Controle de combustível
  │   ├── maintenance/          # Manutenção
  │   ├── tires/                # Pneus
  │   ├── fines/                # Multas
  │   ├── documents/            # Documentos
  │   ├── incidents/            # Sinistros
  │   ├── financial/            # Financeiro / TCO
  │   ├── reports/              # Relatórios
  │   ├── ai-assistant/         # Chat IA
  │   └── settings/             # Configurações da conta
  ├── app.routes.ts             # Array de rotas (provideRouter)
  └── app.ts                    # Componente root (standalone)
  ```
- [x] **0.4.6** — Implementar `main-layout`: usar `po-page-default` ou `po-page-detail` com `po-menu` lateral contendo itens de navegação (Dashboard, Veículos, Motoristas, Combustível, Manutenção, Pneus, Multas, Documentos, Sinistros, Financeiro, Relatórios, IA, Configurações)
- [x] **0.4.7** — Implementar `auth-layout`: layout limpo com logo centralizado para telas de login/registro
- [x] **0.4.8** — Configurar roteamento base com lazy loading:
  ```typescript
  // app.routes.ts — standalone, sem NgModule
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'auth', loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES) },
  { path: 'dashboard', loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES) },
  // ... demais rotas com authGuard (CanActivateFn funcional)
  ```
- [x] **0.4.9** — Implementar `api.service.ts`: wrapper do HttpClient com `baseUrl` configurável via environment, métodos `get<T>`, `post<T>`, `put<T>`, `patch<T>`, `delete<T>`
- [x] **0.4.10** — Implementar `auth.interceptor.ts`: injeta Bearer token no header Authorization de cada request
- [x] **0.4.11** — Implementar `error.interceptor.ts`: captura erros HTTP, exibe `po-notification` (toast) para erros 4xx/5xx, redireciona para login em 401
- [x] **0.4.12** — Configurar `environment.ts` e `environment.prod.ts` com `apiUrl`, `appName`, `version`
- [x] **0.4.13** — Criar página placeholder para dashboard (com texto "Dashboard — em construção")
- [x] **0.4.14** — Verificar que `ng serve` roda sem erros e que o layout PO-UI aparece corretamente

---

### TASK 0.5 — CI/CD e Docker

**Descrição**: Configurar pipeline de integração contínua e containerização.

**Subtasks:**

- [x] **0.5.1** — Criar `Dockerfile` para `apps/api`:
  - Multi-stage build (builder + runner)
  - Node 22 Alpine
  - Copiar apenas `dist/` e `node_modules` para a imagem final
  - Healthcheck integrado
- [x] **0.5.2** — Criar `Dockerfile` para `apps/web`:
  - Multi-stage: Angular build → Nginx Alpine servindo os estáticos
  - Nginx config com SPA fallback (try_files), gzip, cache headers
- [x] **0.5.3** — Criar `docker-compose.prod.yml` com todos os serviços (api, web, postgres, redis)
- [x] **0.5.4** — Criar `.github/workflows/ci.yml`:
  ```yaml
  on: [push, pull_request]
  jobs:
    lint: # ESLint + Prettier check
    type-check: # tsc --noEmit em todos os packages
    test: # Jest/Vitest em todos os packages
    build: # turbo build para garantir que compila
  ```
- [x] **0.5.5** — Criar `.github/workflows/deploy.yml` (trigger em push na `main`):
  - Build das imagens Docker
  - Push para ECR (ou Docker Hub)
  - Deploy no servidor (EC2 via SSH, ou ECS)
- [ ] **0.5.6** — Configurar GitHub branch protection: require PR, require CI pass, require 1 approval
  - Procedimento manual documentado em `docs/deployment.md`

---

### TASK 0.6 — Shared Package: Tipos, Enums e DTOs Base

**Descrição**: Criar os tipos TypeScript compartilhados entre frontend e backend.

**Subtasks:**

- [x] **0.6.1** — Criar enums em `packages/shared/src/enums/`:

  ```typescript
  // plan.enum.ts
  export enum PlanType {
    ESSENTIAL = 'ESSENTIAL',
    PROFESSIONAL = 'PROFESSIONAL',
    ENTERPRISE = 'ENTERPRISE',
  }

  // tenant-status.enum.ts
  export enum TenantStatus {
    TRIAL = 'TRIAL',
    ACTIVE = 'ACTIVE',
    SUSPENDED = 'SUSPENDED',
    CANCELLED = 'CANCELLED',
  }

  // user-role.enum.ts
  export enum UserRole {
    OWNER = 'OWNER',
    ADMIN = 'ADMIN',
    MANAGER = 'MANAGER',
    FINANCIAL = 'FINANCIAL',
    DRIVER = 'DRIVER',
    VIEWER = 'VIEWER',
  }

  // vehicle-status.enum.ts
  export enum VehicleStatus {
    ACTIVE = 'ACTIVE',
    MAINTENANCE = 'MAINTENANCE',
    RESERVE = 'RESERVE',
    DECOMMISSIONED = 'DECOMMISSIONED',
    INCIDENT = 'INCIDENT',
  }

  // fuel-type.enum.ts
  export enum FuelType {
    GASOLINE = 'GASOLINE',
    ETHANOL = 'ETHANOL',
    DIESEL = 'DIESEL',
    DIESEL_S10 = 'DIESEL_S10',
    GNV = 'GNV',
    ELECTRIC = 'ELECTRIC',
    HYBRID = 'HYBRID',
  }

  // vehicle-category.enum.ts
  export enum VehicleCategory {
    LIGHT = 'LIGHT',
    HEAVY = 'HEAVY',
    MOTORCYCLE = 'MOTORCYCLE',
    MACHINE = 'MACHINE',
    BUS = 'BUS',
  }

  // maintenance-type.enum.ts
  export enum MaintenanceType {
    PREVENTIVE = 'PREVENTIVE',
    CORRECTIVE = 'CORRECTIVE',
    PREDICTIVE = 'PREDICTIVE',
  }

  // os-status.enum.ts
  export enum ServiceOrderStatus {
    OPEN = 'OPEN',
    APPROVED = 'APPROVED',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
  }

  // fine-severity.enum.ts
  export enum FineSeverity {
    LIGHT = 'LIGHT',
    MEDIUM = 'MEDIUM',
    SERIOUS = 'SERIOUS',
    VERY_SERIOUS = 'VERY_SERIOUS',
  }

  // incident-type.enum.ts
  export enum IncidentType {
    COLLISION = 'COLLISION',
    THEFT = 'THEFT',
    VANDALISM = 'VANDALISM',
    NATURAL = 'NATURAL',
    OTHER = 'OTHER',
  }

  // document-type.enum.ts
  export enum DocumentType {
    IPVA = 'IPVA',
    LICENSING = 'LICENSING',
    INSURANCE = 'INSURANCE',
    ANTT = 'ANTT',
    AET = 'AET',
    MOPP = 'MOPP',
    INSPECTION = 'INSPECTION',
    OTHER = 'OTHER',
  }

  // checklist-status.enum.ts
  export enum ChecklistItemStatus {
    OK = 'OK',
    ATTENTION = 'ATTENTION',
    NON_COMPLIANT = 'NON_COMPLIANT',
  }
  ```

- [x] **0.6.2** — Criar types base em `packages/shared/src/types/`:

  ```typescript
  // api-response.type.ts
  export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: { code: string; message: string; details?: any };
    meta?: { page: number; limit: number; total: number; totalPages: number };
  }

  // pagination.type.ts
  export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
  }
  ```

- [x] **0.6.3** — Criar DTOs base com zod em `packages/shared/src/dtos/`:
  ```typescript
  // auth.dto.ts → LoginDto, RegisterDto, ForgotPasswordDto, ResetPasswordDto
  // vehicle.dto.ts → CreateVehicleDto, UpdateVehicleDto
  // driver.dto.ts → CreateDriverDto, UpdateDriverDto
  // fuel-record.dto.ts → CreateFuelRecordDto
  // (demais DTOs serão criados conforme os módulos forem implementados)
  ```
- [x] **0.6.4** — Criar constantes em `packages/shared/src/constants/`:
  ```typescript
  // plan-limits.ts
  export const PLAN_LIMITS = {
    ESSENTIAL: { maxVehicles: 10, maxUsers: 3, hasAI: false, hasAPI: false, hasTires: false },
    PROFESSIONAL: { maxVehicles: 100, maxUsers: 20, hasAI: true, hasAPI: true, hasTires: true },
    ENTERPRISE: {
      maxVehicles: Infinity,
      maxUsers: Infinity,
      hasAI: true,
      hasAPI: true,
      hasTires: true,
    },
  };
  ```
- [x] **0.6.5** — Criar utilitários em `packages/shared/src/utils/`:
  ```typescript
  // format.utils.ts → formatCNPJ, formatCPF, formatPhone, formatPlate, formatCurrency
  // validation.utils.ts → isValidCNPJ, isValidCPF, isValidPlate (padrão antigo + Mercosul)
  // date.utils.ts → formatDateBR, daysBetween, isExpired, daysUntilExpiry
  ```
- [x] **0.6.6** — Configurar barrel exports em `packages/shared/src/index.ts`
- [x] **0.6.7** — Escrever testes unitários para todos os utilitários (format, validation, date)

---

## 3. FASE 1 — CORE DO SISTEMA (MVP) (Sprints 4-8)

> **Objetivo**: Autenticação funcional, multi-tenancy, CRUD de veículos e motoristas, dashboard básico. Ao final desta fase, um gestor pode se cadastrar, logar, cadastrar veículos e motoristas.

> **Status atual**: concluída.

---

### TASK 1.1 — Autenticação (Backend)

**Descrição**: Implementar registro, login, refresh token, forgot/reset password.

**Subtasks:**

- [x] **1.1.1** — Instalar dependências: bcryptjs, jsonwebtoken, @types/jsonwebtoken
- [x] **1.1.2** — Criar módulo `apps/api/src/modules/auth/`:
  ```
  auth/
  ├── auth.controller.ts
  ├── auth.routes.ts
  ├── auth.service.ts
  ├── auth.validators.ts    # Schemas zod para cada endpoint
  └── auth.types.ts          # TokenPayload, etc.
  ```
- [x] **1.1.3** — Implementar `POST /api/v1/auth/register`:
  - Input: name, email, password, companyName, cnpj
  - Validar CNPJ (formato e dígitos verificadores)
  - Verificar se CNPJ já existe → ConflictError
  - Verificar se e-mail já existe → ConflictError
  - Hash da senha com bcrypt (salt rounds: 12)
  - Criar Tenant (status: TRIAL, trialEndsAt: now + 14 days)
  - Criar User com role OWNER
  - Gerar access token (JWT, 15 min) e refresh token (JWT, 7 dias)
  - Retornar tokens + dados do user (sem passwordHash)
- [x] **1.1.4** — Implementar `POST /api/v1/auth/login`:
  - Input: email, password
  - Buscar user por email (incluir tenant)
  - Verificar senha com bcrypt
  - Verificar se user isActive
  - Verificar se tenant não está CANCELLED ou SUSPENDED
  - Gerar tokens, atualizar lastLoginAt
  - Retornar tokens + dados do user + dados do tenant
- [x] **1.1.5** — Implementar `POST /api/v1/auth/refresh`:
  - Input: refreshToken
  - Verificar validade do refresh token
  - Gerar novos access + refresh tokens (rotação)
  - Invalidar refresh token anterior (blacklist no Redis, TTL 7 dias)
- [x] **1.1.6** — Implementar `POST /api/v1/auth/forgot-password`:
  - Input: email
  - Gerar token de reset (UUID, salvar hash no banco, TTL 1 hora)
  - Enviar e-mail com link de reset (template HTML básico)
  - Sempre retornar 200 (não revelar se e-mail existe)
- [x] **1.1.7** — Implementar `POST /api/v1/auth/reset-password`:
  - Input: token, newPassword
  - Verificar token válido e não expirado
  - Atualizar senha, invalidar token
- [x] **1.1.8** — Implementar `POST /api/v1/auth/change-password`:
  - Input: currentPassword, newPassword (requer auth)
  - Verificar senha atual, atualizar para nova
- [x] **1.1.9** — Implementar `GET /api/v1/auth/me`:
  - Retornar dados do user autenticado + tenant + plano
- [x] **1.1.10** — Implementar middleware `auth.ts`:
  - Extrair Bearer token do header
  - Verificar JWT (secret, expiração)
  - Buscar user no banco (ou cache Redis)
  - Setar `req.user` com { id, tenantId, role, email }
  - Lançar UnauthorizedError se inválido
- [x] **1.1.11** — Implementar middleware `tenant.ts`:
  - Ler `tenantId` do `req.user`
  - Buscar tenant no banco
  - Verificar status (bloquear se SUSPENDED ou CANCELLED)
  - Setar `req.tenant` com dados do tenant
- [x] **1.1.12** — Implementar middleware `authorize(...roles: UserRole[])`:
  - Verificar se `req.user.role` está na lista de roles permitidos
  - Lançar ForbiddenError se não autorizado
- [x] **1.1.13** — Escrever testes: register (sucesso, CNPJ duplicado, email duplicado, CNPJ inválido), login (sucesso, senha errada, user inativo), refresh, me
- [x] **1.1.14** — Implementar rate limiting específico para auth: 5 tentativas de login por minuto por IP, 3 tentativas de forgot-password por hora por email

---

### TASK 1.2 — Autenticação (Frontend)

**Descrição**: Telas de login, registro e integração com o backend.

**Subtasks:**

- [x] **1.2.1** — Criar `features/auth/auth.routes.ts` (standalone, sem NgModule)
- [x] **1.2.2** — Implementar tela de **Login** (`auth/login`):
  - Formulário PO-UI: email (po-input), senha (po-password)
  - Botão "Entrar" com loading state
  - Link "Esqueci minha senha"
  - Link "Não tem conta? Cadastre-se grátis"
  - Validação no frontend (required, email format)
  - Chamar `POST /auth/login`, salvar tokens no localStorage, redirecionar para dashboard
- [x] **1.2.3** — Implementar tela de **Registro** (`auth/register`):
  - Formulário: nome, email, senha, confirmação de senha, nome da empresa, CNPJ
  - Máscara de CNPJ (po-input com mask)
  - Validação: senha mínimo 8 chars, confirmação match, CNPJ válido
  - Chamar `POST /auth/register`, salvar tokens, redirecionar para wizard de onboarding
- [x] **1.2.4** — Implementar tela de **Esqueci minha senha** (`auth/forgot-password`):
  - Input de e-mail
  - Exibir mensagem de sucesso (sempre, por segurança)
- [x] **1.2.5** — Implementar tela de **Redefinir senha** (`auth/reset-password?token=xxx`):
  - Nova senha + confirmação
  - Validação de token via backend
- [x] **1.2.6** — Implementar `auth.service.ts`:
  - Métodos: login(), register(), forgotPassword(), resetPassword(), refreshToken(), logout(), getMe(), isAuthenticated()
  - Armazenar tokens no localStorage
  - Getter computado para currentUser (BehaviorSubject)
  - Auto-refresh do token quando faltam 2 minutos para expirar
- [x] **1.2.7** — Implementar `auth.guard.ts`: redirecionar para `/auth/login` se não autenticado
- [x] **1.2.8** — Implementar `role.guard.ts`: verificar role mínimo para acessar rota (data: { roles: ['OWNER', 'ADMIN'] })
- [x] **1.2.9** — Implementar lógica de logout: limpar tokens, redirecionar para login

---

### TASK 1.3 — CRUD de Veículos (Backend)

**Descrição**: API completa de gestão de veículos — o recurso mais central do sistema.

**Subtasks:**

- [x] **1.3.1** — Criar migration Prisma para tabela `Vehicle`:

  ```prisma
  model Vehicle {
    id              String          @id @default(uuid())
    tenantId        String
    plate           String          // Ex: ABC1D23 (Mercosul) ou ABC-1234
    renavam         String?
    chassis         String?
    brand           String          // Ex: Volkswagen
    model           String          // Ex: Delivery 11.180
    year            Int             // Ano fabricação
    yearModel       Int             // Ano modelo
    color           String?
    fuelType        FuelType
    category        VehicleCategory
    status          VehicleStatus   @default(ACTIVE)
    currentMileage  Int             @default(0) // Km atual
    averageConsumption Float?       // Consumo médio real calculado (km/l)
    expectedConsumption Float?      // Consumo médio do fabricante
    acquisitionDate DateTime?
    acquisitionValue Float?
    photos          Json?           // Array de URLs S3
    notes           String?
    currentDriverId String?         // Motorista atualmente vinculado
    createdAt       DateTime        @default(now())
    updatedAt       DateTime        @updatedAt

    @@unique([tenantId, plate])
    @@index([tenantId])
    @@index([tenantId, status])
  }
  ```

- [x] **1.3.2** — Criar módulo `apps/api/src/modules/vehicles/`
- [x] **1.3.3** — Implementar `GET /api/v1/vehicles` — listagem com paginação, filtros (status, category, fuelType, search por placa/modelo), ordenação
- [x] **1.3.4** — Implementar `GET /api/v1/vehicles/:id` — detalhes do veículo com timeline de eventos
- [x] **1.3.5** — Implementar `POST /api/v1/vehicles` — criação com validação (placa única no tenant, placa formato válido, campos obrigatórios)
- [x] **1.3.6** — Implementar `PUT /api/v1/vehicles/:id` — atualização completa
- [x] **1.3.7** — Implementar `PATCH /api/v1/vehicles/:id/status` — alterar status (com validação de transição: não pode ir de DECOMMISSIONED para ACTIVE, etc.)
- [x] **1.3.8** — Implementar `PATCH /api/v1/vehicles/:id/mileage` — atualizar quilometragem (validar que novo valor >= atual)
- [x] **1.3.9** — Implementar `DELETE /api/v1/vehicles/:id` — soft delete (setar status DECOMMISSIONED) ou hard delete se nunca teve movimentação
- [x] **1.3.10** — Implementar `POST /api/v1/vehicles/import` — importação via CSV/Excel (upload de arquivo, parse, validação em batch, retorno de erros por linha)
- [x] **1.3.11** — Implementar `GET /api/v1/vehicles/export` — exportação da lista em CSV
- [x] **1.3.12** — Implementar `GET /api/v1/vehicles/stats` — resumo: total por status, total por categoria, média de idade da frota, km médio
- [x] **1.3.13** — Implementar verificação de limite do plano: antes de criar veículo, verificar se tenant não excedeu maxVehicles do plano
- [x] **1.3.14** — Implementar audit log: registrar criação, edição e exclusão de veículos na tabela AuditLog
- [x] **1.3.15** — Escrever testes: CRUD completo, filtros, paginação, import, limite de plano, validações de placa

---

### TASK 1.4 — CRUD de Veículos (Frontend)

**Descrição**: Telas de listagem, cadastro e edição de veículos usando PO-UI.

**Subtasks:**

- [x] **1.4.1** — Criar `features/vehicles/vehicles.routes.ts` (standalone, sem NgModule)
- [x] **1.4.2** — Implementar **listagem** (`vehicles/list`):
  - `po-page-list` com `po-table` (colunas: placa, marca/modelo, ano, categoria, status, km, ações)
  - Filtros: `po-combo` para status, categoria, tipo combustível; `po-input` para busca textual
  - Ações por linha: Editar, Ver detalhes, Alterar status
  - Ação de página: "Novo Veículo", "Importar", "Exportar"
  - Paginação server-side via `po-table` com `p-service-api`
  - Badges coloridos para status (verde=ativo, amarelo=manutenção, cinza=reserva, vermelho=baixado)
- [x] **1.4.3** — Implementar **formulário de criação/edição** (`vehicles/form`):
  - `po-page-edit` com `po-dynamic-form` ou formulário manual
  - Campos: placa (com máscara Mercosul), RENAVAM, chassi, marca, modelo, ano, ano modelo, cor, tipo combustível, categoria, km atual, consumo esperado, data aquisição, valor aquisição, observações
  - Upload de fotos (até 4, com preview)
  - Validação client-side: placa obrigatória e formato válido, ano entre 1950 e ano atual+1
- [x] **1.4.4** — Implementar **tela de detalhes** (`vehicles/:id`):
  - `po-page-detail` com informações do veículo
  - Tabs: Dados, Manutenções, Abastecimentos, Multas, Documentos, Timeline
  - (as tabs serão populadas conforme os módulos forem desenvolvidos)
  - Card de resumo: custo total acumulado, última manutenção, próximo vencimento
- [x] **1.4.5** — Implementar **modal de importação**:
  - Upload de arquivo CSV/Excel
  - Preview dos dados importados em tabela
  - Exibição de erros de validação por linha
  - Botão de confirmação da importação
  - Download de template de exemplo
- [x] **1.4.6** — Implementar `vehicles.service.ts` no frontend com métodos para todos os endpoints

---

### TASK 1.5 — CRUD de Motoristas (Backend)

**Descrição**: API completa de gestão de motoristas/condutores.

**Subtasks:**

- [x] **1.5.1** — Criar migration Prisma para tabela `Driver`:

  ```prisma
  model Driver {
    id                String    @id @default(uuid())
    tenantId          String
    name              String
    cpf               String
    phone             String?
    email             String?
    birthDate         DateTime?
    cnhNumber         String?
    cnhCategory       String?   // A, B, AB, C, D, E, etc.
    cnhExpiration     DateTime?
    cnhPoints         Int?      @default(0)
    emergencyContact  String?
    emergencyPhone    String?
    department        String?   // Setor/departamento da empresa
    isActive          Boolean   @default(true)
    photoUrl          String?
    hireDate          DateTime?
    score             Float?    @default(100) // Score de 0-100 calculado pela IA
    notes             String?
    userId            String?   // Vinculo com User (caso o motorista acesse o sistema)
    createdAt         DateTime  @default(now())
    updatedAt         DateTime  @updatedAt

    @@unique([tenantId, cpf])
    @@index([tenantId])
    @@index([tenantId, isActive])
  }
  ```

- [x] **1.5.2** — Criar módulo `apps/api/src/modules/drivers/`
- [x] **1.5.3** — Implementar CRUD completo: `GET /drivers` (list + search + paginação), `GET /drivers/:id`, `POST /drivers`, `PUT /drivers/:id`, `DELETE /drivers/:id`
- [x] **1.5.4** — Implementar `GET /drivers/:id/history` — histórico de veículos que dirigiu, multas, sinistros, abastecimentos
- [x] **1.5.5** — Implementar `POST /drivers/import` — importação via CSV
- [x] **1.5.6** — Implementar validação de CPF (dígitos verificadores)
- [x] **1.5.7** — Implementar alerta de vencimento de CNH (retornar flag `cnhExpiring` quando faltam ≤30 dias)
- [x] **1.5.8** — Implementar `PATCH /drivers/:id/link-vehicle/:vehicleId` — vincular motorista a um veículo
- [x] **1.5.9** — Escrever testes

---

### TASK 1.6 — CRUD de Motoristas (Frontend)

**Subtasks:**

- [x] **1.6.1** — Criar `features/drivers/drivers.routes.ts` (standalone, sem NgModule)
- [x] **1.6.2** — Implementar listagem com `po-table`: nome, CPF, CNH (categoria + validade), telefone, departamento, score, status
- [x] **1.6.3** — Implementar formulário de criação/edição com campos e máscaras (CPF, telefone)
- [x] **1.6.4** — Implementar tela de detalhes com tabs: Dados, Veículos Vinculados, Multas, Sinistros, Score
- [x] **1.6.5** — Highlight visual quando CNH está vencida ou próxima do vencimento (badge vermelho/amarelo)
- [x] **1.6.6** — Implementar vinculação motorista ↔ veículo com `po-combo` de seleção

---

### TASK 1.7 — Dashboard Principal

**Descrição**: Dashboard com visão geral da frota e KPIs.

**Subtasks:**

- [x] **1.7.1** — Backend: implementar `GET /api/v1/dashboard/summary` retornando:
  ```json
  {
    "vehicles": { "total": 45, "active": 38, "maintenance": 5, "reserve": 2 },
    "drivers": { "total": 30, "active": 28, "cnhExpiring": 3 },
    "alerts": { "maintenanceDue": 8, "documentsExpiring": 5, "pendingFines": 2 },
    "costs": { "currentMonth": 45200, "previousMonth": 41800, "variation": 8.1 },
    "recentActivity": [
      /* últimos 10 eventos */
    ]
  }
  ```
- [x] **1.7.2** — Frontend: criar `features/dashboard/dashboard.component.ts`
- [x] **1.7.3** — Implementar cards de resumo no topo: Total de Veículos (com breakdown por status), Total de Motoristas, Alertas Pendentes, Custo do Mês
- [x] **1.7.4** — Implementar widget de "Alertas" (lista das próximas manutenções vencendo, documentos expirando, CNHs vencendo) com `po-list-view` ou cards
- [x] **1.7.5** — Implementar widget de "Atividade Recente" (timeline dos últimos eventos: cadastros, abastecimentos, OS criadas)
- [x] **1.7.6** — Implementar gráfico de "Custo Mensal" (barras empilhadas: combustível, manutenção, multas, outros) — usar Chart.js ou po-chart se disponível
- [x] **1.7.7** — Implementar gráfico de "Distribuição de Veículos por Status" (donut chart)
- [x] **1.7.8** — Responsividade: cards em grid que se adapta a telas menores

---

## 4. FASE 2 — MÓDULOS OPERACIONAIS (Sprints 9-12)

> **Objetivo**: Implementar os módulos de negócio que geram valor real: combustível, manutenção, pneus, multas, documentos, sinistros, financeiro.

---

### TASK 2.1 — Módulo de Combustível

**Subtasks:**

- [x] **2.1.1** — Migration: tabela `FuelRecord` (id, tenantId, vehicleId, driverId, date, mileage, liters, totalCost, pricePerLiter, fuelType, gasStation, fullTank, notes, receiptUrl, createdByUserId, createdAt)
- [x] **2.1.2** — Backend CRUD: `GET /vehicles/:vehicleId/fuel-records`, `POST /fuel-records`, `PUT /fuel-records/:id`, `DELETE /fuel-records/:id`
- [x] **2.1.3** — Backend: cálculo automático de km/l ao salvar (com base na diferença de km entre abastecimentos)
- [x] **2.1.4** — Backend: atualização automática de `vehicle.currentMileage` ao registrar abastecimento (se km informado > atual)
- [x] **2.1.5** — Backend: detecção de anomalia — se km/l < 60% da média do veículo, marcar flag `anomaly: true` e motivo
- [x] **2.1.6** — Backend: `GET /fuel-records/stats` — total gasto, litros consumidos, média km/l, custo/km por período
- [x] **2.1.7** — Backend: `GET /fuel-records/ranking` — ranking de veículos por eficiência (melhor e pior km/l)
- [x] **2.1.8** — Frontend: listagem de abastecimentos com filtros (veículo, motorista, período, posto)
- [x] **2.1.9** — Frontend: formulário de registro com seleção de veículo (po-combo com busca), motorista, campos numéricos
- [x] **2.1.10** — Frontend: dashboard de combustível com gráficos (evolução de consumo, custo mensal, ranking)
- [x] **2.1.11** — Frontend: highlight de registros com anomalia (linha vermelha na tabela)

---

### TASK 2.2 — Módulo de Manutenção

**Subtasks:**

- [x] **2.2.1** — Migration: tabelas `MaintenancePlan`, `ServiceOrder`, `ServiceOrderItem`

  ```
  MaintenancePlan: id, tenantId, vehicleId, name (ex: "Troca de óleo"), type (PREVENTIVE/CORRECTIVE),
    intervalKm, intervalDays, lastExecutedAt, lastExecutedMileage, nextDueAt, nextDueMileage, isActive

  ServiceOrder: id, tenantId, vehicleId, driverId, planId?, type, status (OPEN→APPROVED→IN_PROGRESS→COMPLETED→CANCELLED),
    description, workshop, startDate, endDate, totalCost, laborCost, partsCost, notes, photos, approvedByUserId, createdByUserId

  ServiceOrderItem: id, serviceOrderId, description, quantity, unitCost, totalCost, partNumber?
  ```

- [x] **2.2.2** — Backend CRUD de planos de manutenção
- [x] **2.2.3** — Backend CRUD de ordens de serviço com workflow de status (validar transições: OPEN→APPROVED ou CANCELLED, APPROVED→IN_PROGRESS, IN_PROGRESS→COMPLETED)
- [x] **2.2.4** — Backend: job agendado (BullMQ/cron) que roda diariamente verificando planos de manutenção vencidos → gera alerta
- [x] **2.2.5** — Backend: `GET /maintenance/alerts` — lista de manutenções vencidas e próximas de vencer
- [x] **2.2.6** — Backend: cálculo de MTTR e MTBF por veículo
- [x] **2.2.7** — Backend: `GET /maintenance/stats` — custos de manutenção por período, por veículo, preventiva vs corretiva
- [x] **2.2.8** — Frontend: listagem de planos de manutenção com status visual (verde=em dia, amarelo=próximo, vermelho=vencido)
- [ ] **2.2.9** — Frontend: listagem de ordens de serviço com filtros (status, veículo, período)
- [ ] **2.2.10** — Frontend: formulário de OS com adição dinâmica de itens/peças, upload de fotos e NF
- [ ] **2.2.11** — Frontend: workflow visual de aprovação (botões de ação conforme status atual e role do usuário)
- [ ] **2.2.12** — Frontend: dashboard de manutenção (custos, OS abertas vs fechadas, veículos parados)

---

### TASK 2.3 — Módulo de Documentos e Vencimentos

**Subtasks:**

- [ ] **2.3.1** — Migration: tabela `Document` (id, tenantId, vehicleId?, driverId?, type, description, expirationDate, alertDaysBefore, cost?, fileUrl, status, notes, createdAt)
- [ ] **2.3.2** — Backend CRUD com filtros por tipo, veículo, motorista, status (vigente, vencido, próximo)
- [ ] **2.3.3** — Backend: job diário para verificar vencimentos e gerar alertas (notificação + painel)
- [ ] **2.3.4** — Backend: `GET /documents/pending` — documentos que vencem nos próximos 30/60/90 dias
- [ ] **2.3.5** — Frontend: painel de documentos com cards por tipo e visual de semáforo (verde/amarelo/vermelho)
- [ ] **2.3.6** — Frontend: formulário com upload de arquivo e configuração de alerta
- [ ] **2.3.7** — Frontend: calendário de vencimentos (view mensal)

---

### TASK 2.4 — Módulo de Multas

**Subtasks:**

- [ ] **2.4.1** — Migration: tabela `Fine` (id, tenantId, vehicleId, driverId?, date, autoNumber, location, description, severity, points, amount, discountAmount?, dueDate, status [PENDING, DRIVER_IDENTIFIED, APPEALED, PAID, PAYROLL_DEDUCTED], payrollDeduction, notes, fileUrl, createdAt)
- [ ] **2.4.2** — Backend CRUD com fluxo de status
- [ ] **2.4.3** — Backend: `POST /fines/import` — importação de planilha de multas
- [ ] **2.4.4** — Backend: `GET /fines/stats` — total de multas por período, por motorista, por tipo, valor total
- [ ] **2.4.5** — Frontend: listagem com filtros e ações de workflow (identificar condutor, registrar recurso, registrar pagamento)
- [ ] **2.4.6** — Frontend: modal de identificação do condutor (selecionar motorista + data de entrega ao DETRAN)
- [ ] **2.4.7** — Frontend: dashboard de multas (ranking de motoristas, tipos mais frequentes, custo acumulado)

---

### TASK 2.5 — Módulo de Pneus (Plano Profissional+)

**Subtasks:**

- [ ] **2.5.1** — Migration: tabelas `Tire` e `TireInspection`

  ```
  Tire: id, tenantId, brand, model, size, serialNumber, dot, status (NEW, IN_USE, RETREADED, DISCARDED),
    currentVehicleId?, position?, currentGrooveDepth, originalGrooveDepth, retreatCount, costNew, costRetreat, totalKm, createdAt

  TireInspection: id, tireId, vehicleId, inspectedByUserId, date, grooveDepth, position, photos, notes, createdAt
  ```

- [ ] **2.5.2** — Backend CRUD de pneus com ciclo de vida
- [ ] **2.5.3** — Backend: registro de inspeção (sulcagem) com cálculo de desgaste
- [ ] **2.5.4** — Backend: `PATCH /tires/:id/move` — movimentar pneu entre veículos/posições
- [ ] **2.5.5** — Backend: alerta de troca quando sulco < limite configurável (ex: 3mm)
- [ ] **2.5.6** — Backend: cálculo de custo por km rodado por pneu e comparativo entre marcas
- [ ] **2.5.7** — Frontend: mapa visual do veículo mostrando posição dos pneus (SVG interativo com eixos)
- [ ] **2.5.8** — Frontend: histórico de inspeções com gráfico de desgaste ao longo do tempo
- [ ] **2.5.9** — Gate de plano: middleware que bloqueia acesso ao módulo de pneus para plano ESSENTIAL

---

### TASK 2.6 — Módulo de Sinistros

**Subtasks:**

- [ ] **2.6.1** — Migration: tabela `Incident` (id, tenantId, vehicleId, driverId?, date, location, type, description, thirdPartyInvolved, policeReport, insurerNotified, insuranceClaimNumber, estimatedCost, actualCost, status [REGISTERED, UNDER_ANALYSIS, IN_REPAIR, CONCLUDED], photos, documents, downtime, notes, createdAt)
- [ ] **2.6.2** — Backend CRUD com fluxo de status
- [ ] **2.6.3** — Backend: `GET /incidents/stats` — frequência, custo médio, tempo de indisponibilidade
- [ ] **2.6.4** — Frontend: formulário com upload de múltiplas fotos e documentos
- [ ] **2.6.5** — Frontend: listagem com timeline de acompanhamento

---

### TASK 2.7 — Módulo Financeiro e TCO

**Subtasks:**

- [ ] **2.7.1** — Backend: `GET /financial/tco/:vehicleId` — calcular TCO somando:
  - Combustível (sum de fuel_records.totalCost)
  - Manutenção (sum de service_orders.totalCost)
  - Pneus (sum de compras e recapagens)
  - Multas (sum de fines.amount com status PAID)
  - Documentos (sum de documents.cost — IPVA, seguro, etc.)
  - Depreciação (valor aquisição - valor FIPE atual, se disponível)
- [ ] **2.7.2** — Backend: `GET /financial/tco/:vehicleId` com custo/km (TCO / km total rodado)
- [ ] **2.7.3** — Backend: `GET /financial/overview` — visão consolidada: total de gastos por categoria, evolução mensal, budget vs realizado
- [ ] **2.7.4** — Backend: `GET /financial/comparison` — comparar custo de veículos semelhantes (mesmo modelo/ano)
- [ ] **2.7.5** — Frontend: dashboard financeiro com gráficos de evolução, breakdown por categoria (donut), ranking de veículos mais caros
- [ ] **2.7.6** — Frontend: tela de TCO por veículo com detalhamento de cada componente de custo
- [ ] **2.7.7** — Frontend: comparativo entre veículos (tabela side-by-side)

---

### TASK 2.8 — Checklist de Inspeção

**Subtasks:**

- [ ] **2.8.1** — Migration: tabelas `ChecklistTemplate`, `ChecklistItem`, `ChecklistExecution`, `ChecklistExecutionItem`

  ```
  ChecklistTemplate: id, tenantId, name, vehicleCategory?, items (Json array of {label, required, photoRequired})

  ChecklistExecution: id, tenantId, templateId, vehicleId, driverId, executedAt, status (COMPLIANT, NON_COMPLIANT, ATTENTION),
    signatureUrl, location, notes, createdByUserId

  ChecklistExecutionItem: id, executionId, label, status (OK, ATTENTION, NON_COMPLIANT), photo?, notes?
  ```

- [ ] **2.8.2** — Backend: CRUD de templates de checklist
- [ ] **2.8.3** — Backend: `POST /checklists/execute` — registrar execução de checklist
- [ ] **2.8.4** — Backend: quando item é NON_COMPLIANT → criar automaticamente uma OS de manutenção corretiva
- [ ] **2.8.5** — Backend: `GET /checklists/compliance` — % de conformidade da frota por período
- [ ] **2.8.6** — Frontend: editor de templates de checklist (drag-and-drop dos itens)
- [ ] **2.8.7** — Frontend: histórico de execuções com filtro por veículo/motorista/período
- [ ] **2.8.8** — (O preenchimento do checklist será feito via app mobile — Fase 4)

---

### TASK 2.9 — Sistema de Alertas e Notificações

**Subtasks:**

- [ ] **2.9.1** — Migration: tabela `Notification` (id, tenantId, userId, type, title, message, entityType, entityId, isRead, readAt, createdAt)
- [ ] **2.9.2** — Backend: `NotificationService` centralizado com métodos `create()`, `markAsRead()`, `markAllAsRead()`, `getUnread()`
- [ ] **2.9.3** — Backend: `GET /notifications` — listagem paginada (com filtro read/unread)
- [ ] **2.9.4** — Backend: `PATCH /notifications/:id/read` e `PATCH /notifications/read-all`
- [ ] **2.9.5** — Backend: job agendado (cron diário) que gera notificações para:
  - Manutenções vencendo (conforme plano)
  - Documentos expirando (conforme alertDaysBefore)
  - CNHs de motoristas vencendo
  - Multas com prazo de recurso chegando
- [ ] **2.9.6** — Backend: envio de e-mail para notificações críticas (manutenção vencida, documento expirado)
- [ ] **2.9.7** — Frontend: ícone de sino no header com badge de contagem de não-lidas
- [ ] **2.9.8** — Frontend: dropdown/painel de notificações com lista e ação de "marcar como lida"
- [ ] **2.9.9** — Frontend: link na notificação que leva diretamente à entidade (ex: clicar na notificação de manutenção abre a OS)

---

## 5. FASE 3 — INTELIGÊNCIA ARTIFICIAL (Sprints 13-15)

> **Objetivo**: Integrar Claude API para análises, assistente conversacional, OCR e relatórios automáticos.

---

### TASK 3.1 — Package de IA (packages/ai)

**Subtasks:**

- [ ] **3.1.1** — Criar `packages/ai` com estrutura:
  ```
  packages/ai/
  ├── src/
  │   ├── client.ts          # Claude API client wrapper
  │   ├── prompts/           # System prompts templates
  │   │   ├── assistant.prompt.ts
  │   │   ├── analysis.prompt.ts
  │   │   ├── report.prompt.ts
  │   │   └── ocr.prompt.ts
  │   ├── services/
  │   │   ├── assistant.service.ts     # Chat conversacional
  │   │   ├── analysis.service.ts      # Análise de dados da frota
  │   │   ├── report.service.ts        # Geração de relatórios
  │   │   ├── ocr.service.ts           # OCR de cupons/NFs
  │   │   └── anomaly.service.ts       # Detecção de anomalias
  │   ├── types.ts
  │   └── index.ts
  ├── tsconfig.json
  └── package.json
  ```
- [ ] **3.1.2** — Implementar `client.ts`: wrapper do SDK Anthropic com retry, rate limiting, error handling, e seleção de modelo (Haiku para tarefas simples, Sonnet para análises complexas)
- [ ] **3.1.3** — Implementar controle de custo: contar tokens por request, limitar por plano (PROFESSIONAL: 100 queries IA/mês, ENTERPRISE: ilimitado)
- [ ] **3.1.4** — Implementar cache de respostas IA no Redis (TTL configurável) para queries repetidas

---

### TASK 3.2 — Assistente IA Conversacional

**Subtasks:**

- [ ] **3.2.1** — Backend: `POST /api/v1/ai/chat` — endpoint de chat com contexto da frota
- [ ] **3.2.2** — Implementar system prompt que instrui o Claude sobre:
  - O contexto: é um assistente de gestão de frotas
  - Dados disponíveis: veículos, motoristas, abastecimentos, manutenções, multas, custos
  - Formato de resposta: texto com suporte a markdown
  - Limitações: não inventar dados, basear-se apenas nos dados reais
- [ ] **3.2.3** — Implementar injeção de contexto: antes de cada query, buscar dados relevantes do tenant e incluir no prompt (ex: se pergunta sobre veículo, incluir dados do veículo)
- [ ] **3.2.4** — Implementar histórico de conversa: salvar mensagens no Redis (TTL 24h) para manter contexto multi-turn
- [ ] **3.2.5** — Backend: `GET /api/v1/ai/chat/history` — recuperar histórico de conversa
- [ ] **3.2.6** — Frontend: criar `features/ai-assistant/` com interface de chat (input de texto, lista de mensagens, avatar do bot, indicador de "digitando")
- [ ] **3.2.7** — Frontend: sugestões de perguntas prontas para o usuário (chips clicáveis): "Resumo do mês", "Veículos com maior custo", "Motoristas com mais multas"
- [ ] **3.2.8** — Frontend: renderização de markdown nas respostas (tabelas, listas, negrito)

---

### TASK 3.3 — Análise Preditiva e Anomalias

**Subtasks:**

- [ ] **3.3.1** — Implementar `anomaly.service.ts`: análise batch dos dados da frota para detectar:
  - Consumo de combustível fora do padrão (desvio > 2 sigma da média do veículo)
  - Custo de manutenção acima do esperado para modelo/idade do veículo
  - Padrões de multa incomuns
  - Veículos com custo/km crescente (tendência de piora)
- [ ] **3.3.2** — Backend: job semanal (BullMQ) que roda a análise de anomalias para cada tenant e gera notificações
- [ ] **3.3.3** — Implementar `analysis.service.ts`: dado um veículo, usar Claude para analisar histórico e gerar:
  - Probabilidade de falha de componentes
  - Recomendação de manutenção antecipada
  - Score de saúde do veículo (0-100)
- [ ] **3.3.4** — Frontend: widget de "Insights IA" no dashboard com os alertas de anomalia
- [ ] **3.3.5** — Frontend: na tela de detalhes do veículo, seção "Análise IA" com health score e previsões

---

### TASK 3.4 — Relatório Mensal Automático

**Subtasks:**

- [ ] **3.4.1** — Implementar `report.service.ts`: agregar dados do mês (custos, manutenções, multas, consumo) e enviar para Claude gerar narrativa em português
- [ ] **3.4.2** — Backend: job mensal (dia 1 de cada mês) que gera relatório para cada tenant ativo
- [ ] **3.4.3** — Backend: salvar relatório gerado em tabela `AIReport` (id, tenantId, period, content, createdAt)
- [ ] **3.4.4** — Backend: enviar relatório por e-mail para users com role OWNER e ADMIN
- [ ] **3.4.5** — Frontend: tela de "Relatórios IA" com lista de relatórios mensais e visualização do conteúdo

---

### TASK 3.5 — OCR de Cupons e Notas Fiscais

**Subtasks:**

- [ ] **3.5.1** — Implementar `ocr.service.ts`: receber imagem (base64), enviar para Claude Vision, extrair dados estruturados
- [ ] **3.5.2** — Backend: `POST /api/v1/ai/ocr/fuel` — upload de foto de cupom fiscal → retornar JSON com { liters, totalCost, pricePerLiter, gasStation, date }
- [ ] **3.5.3** — Backend: `POST /api/v1/ai/ocr/invoice` — upload de NF de manutenção → retornar JSON com itens, valores, fornecedor
- [ ] **3.5.4** — Frontend: no formulário de abastecimento, botão "Escanear cupom" que abre câmera, tira foto, envia para OCR e preenche campos automaticamente
- [ ] **3.5.5** — Frontend: feedback visual de confiança nos dados extraídos (campo preenchido com borda verde = alta confiança, amarelo = verificar)

---

### TASK 3.6 — Scoring de Motoristas com IA

**Subtasks:**

- [ ] **3.6.1** — Implementar cálculo de score que pondera: consumo de combustível (25%), multas (25%), sinistros (20%), aderência ao checklist (15%), cuidado com veículo (15%)
- [ ] **3.6.2** — Backend: job semanal que recalcula score de todos os motoristas
- [ ] **3.6.3** — Backend: usar Claude para gerar recomendações textuais por motorista ("precisa de treinamento X", "candidato a bonificação")
- [ ] **3.6.4** — Frontend: ranking de motoristas com score, badges e recomendações IA
- [ ] **3.6.5** — Frontend: gamificação — tela de "Conquistas" visível para o motorista no app mobile

---

## 6. FASE 4 — APP MOBILE E EXPERIÊNCIA DO MOTORISTA (Sprints 16-17)

> **Objetivo**: PWA mobile para motoristas realizarem checklist, registrarem abastecimentos e receberem notificações.

---

### TASK 4.1 — Setup do App Mobile (apps/mobile)

**Subtasks:**

- [ ] **4.1.1** — Criar projeto Angular PWA: `ng new mobile --style=scss --routing --strict`
- [ ] **4.1.2** — Instalar PO-UI com tema mobile, adicionar `@angular/pwa`
- [ ] **4.1.3** — Configurar `manifest.webmanifest` (nome, ícones, cores, orientation: portrait)
- [ ] **4.1.4** — Configurar service worker para cache offline (app-shell, API responses com stale-while-revalidate)
- [ ] **4.1.5** — Criar layout mobile simplificado (bottom navigation com ícones: Home, Checklist, Abastecer, Alertas, Perfil)
- [ ] **4.1.6** — Implementar login simplificado (email + senha, ou QR Code escaneado da tela do gestor)

---

### TASK 4.2 — Funcionalidades Mobile

**Subtasks:**

- [ ] **4.2.1** — **Home**: resumo do veículo vinculado (placa, km, próximas manutenções, score)
- [ ] **4.2.2** — **Checklist**: preencher checklist de inspeção com fotos, assinatura digital, envio offline
- [ ] **4.2.3** — **Abastecimento**: registrar abastecimento com câmera (OCR do cupom) + campos manuais
- [ ] **4.2.4** — **Reportar problema**: formulário rápido com tipo de problema, descrição, foto, localização GPS automática
- [ ] **4.2.5** — **Notificações**: lista de alertas (manutenção, CNH, multas atribuídas)
- [ ] **4.2.6** — **Perfil**: dados pessoais, score, ranking, badges de gamificação
- [ ] **4.2.7** — **Termo de responsabilidade**: tela para assinar digitalmente ao receber veículo
- [ ] **4.2.8** — Implementar sincronização offline: dados preenchidos sem internet são salvos no IndexedDB e sincronizados quando a conexão retorna (com indicador visual de "pendente de sync")

---

## 7. FASE 5 — BILLING, ONBOARDING E GO-TO-MARKET (Sprints 18-19)

> **Objetivo**: Integrar pagamentos (Stripe), implementar fluxo de onboarding, landing page e preparar para lançamento.

---

### TASK 5.1 — Integração Stripe

**Subtasks:**

- [ ] **5.1.1** — Criar conta Stripe e configurar products/prices para os 3 planos (ESSENTIAL R$20, PROFESSIONAL R$170, ENTERPRISE custom)
- [ ] **5.1.2** — Backend: instalar `stripe` package
- [ ] **5.1.3** — Backend: `POST /api/v1/billing/create-checkout-session` — gera URL do Stripe Checkout para o plano selecionado (com suporte a PIX e cartão)
- [ ] **5.1.4** — Backend: `POST /api/v1/billing/create-portal-session` — gera URL do Stripe Customer Portal (gerenciar assinatura, trocar plano, cancelar)
- [ ] **5.1.5** — Backend: webhook handler `POST /api/v1/billing/webhook` para eventos:
  - `checkout.session.completed` → ativar tenant, setar plano
  - `invoice.paid` → renovação bem-sucedida
  - `invoice.payment_failed` → marcar tenant como SUSPENDED
  - `customer.subscription.deleted` → marcar tenant como CANCELLED
  - `customer.subscription.updated` → atualizar plano (upgrade/downgrade)
- [ ] **5.1.6** — Backend: middleware que verifica status do tenant — se SUSPENDED, retornar 402 com mensagem "Pagamento pendente"
- [ ] **5.1.7** — Backend: job que verifica tenants em TRIAL expirado e envia e-mail de conversão
- [ ] **5.1.8** — Frontend: tela de "Planos e Assinatura" em Settings com:
  - Card do plano atual com detalhes
  - Botões de upgrade/downgrade
  - Botão "Gerenciar pagamento" (abre Stripe Portal)
  - Histórico de faturas
- [ ] **5.1.9** — Frontend: banner de trial ("Você tem X dias restantes. Assine agora!")
- [ ] **5.1.10** — Frontend: tela de bloqueio para tenant SUSPENDED ("Sua assinatura está pendente. Regularize para continuar usando.")

---

### TASK 5.2 — Wizard de Onboarding

**Subtasks:**

- [ ] **5.2.1** — Backend: `GET /api/v1/onboarding/status` — retorna progresso do setup (quais etapas foram concluídas)
- [ ] **5.2.2** — Backend: `PATCH /api/v1/onboarding/complete-step` — marcar etapa como concluída
- [ ] **5.2.3** — Frontend: componente wizard step-by-step com barra de progresso:
  - **Passo 1**: "Sobre sua empresa" — validar CNPJ, preencher dados (já feito no registro, mas permite editar)
  - **Passo 2**: "Adicione seus veículos" — cadastro manual rápido (placa, marca, modelo) ou import CSV + botão "Adicionar dados de demonstração"
  - **Passo 3**: "Cadastre seus motoristas" — formulário rápido ou import + opção "Farei depois"
  - **Passo 4**: "Convide sua equipe" — input de e-mails para enviar convites
  - **Passo 5**: "Pronto! Explore seu painel" — redirect para dashboard com tour guiado
- [ ] **5.2.4** — Frontend: tour guiado (tooltips interativos) no dashboard na primeira visita — apontar para menu, dashboard cards, botão de criar veículo
- [ ] **5.2.5** — Frontend: checklist persistente na sidebar ("Complete seu setup: 3/5 passos") que desaparece quando 100% completo
- [ ] **5.2.6** — Backend: seed de dados de demonstração (10 veículos fictícios, 5 motoristas, 3 meses de abastecimentos, manutenções e multas) que o usuário pode ativar opcionalmente

---

### TASK 5.3 — Gestão de Usuários e Convites

**Subtasks:**

- [ ] **5.3.1** — Backend: `POST /api/v1/users/invite` — enviar convite por e-mail (gera token único, salva invite no banco)
- [ ] **5.3.2** — Backend: `POST /api/v1/users/accept-invite` — aceitar convite, criar user com role definido no convite
- [ ] **5.3.3** — Backend: `GET /api/v1/users` — listar users do tenant (role OWNER e ADMIN apenas)
- [ ] **5.3.4** — Backend: `PATCH /api/v1/users/:id/role` — alterar role de um user
- [ ] **5.3.5** — Backend: `DELETE /api/v1/users/:id` — desativar user
- [ ] **5.3.6** — Backend: verificar limite de usuários do plano antes de criar convite
- [ ] **5.3.7** — Frontend: tela de "Equipe" em Settings com lista de users, convites pendentes, botão de convidar

---

### TASK 5.4 — Configurações do Tenant

**Subtasks:**

- [ ] **5.4.1** — Backend: `GET /PUT /api/v1/settings` — configurações personalizáveis:
  ```json
  {
    "company": { "name", "tradeName", "cnpj", "logo", "address" },
    "alerts": { "maintenanceDaysBefore": 7, "documentDaysBefore": 30, "cnhDaysBefore": 30 },
    "defaults": { "defaultFuelType": "DIESEL", "mileageUnit": "KM" },
    "notifications": { "emailEnabled": true, "whatsappEnabled": false }
  }
  ```
- [ ] **5.4.2** — Frontend: tela de configurações com formulário organizado em seções (tabs ou accordion)
- [ ] **5.4.3** — Frontend: upload de logo da empresa
- [ ] **5.4.4** — Frontend: configuração de alertas (quantos dias antes notificar)

---

### TASK 5.5 — Landing Page

**Subtasks:**

- [ ] **5.5.1** — Criar landing page separada (pode ser HTML estático, Next.js ou mesmo Angular com rota pública) com seções:
  - Hero com headline + CTA "Começar Grátis — 14 dias"
  - Problema ("Ainda controlando frota no Excel?")
  - Features (carrossel visual dos módulos com screenshots)
  - Diferencial IA (demo do assistente ou GIF animado)
  - Comparativo (tabela: Frota Leve vs Excel vs Concorrentes)
  - Planos e preços (cards interativos)
  - FAQ (accordion)
  - Footer (links, LGPD, contato)
- [ ] **5.5.2** — SEO: meta tags, schema.org, sitemap.xml, robots.txt
- [ ] **5.5.3** — Analytics: Google Analytics 4 + eventos de conversão (click no CTA, início de registro)
- [ ] **5.5.4** — Responsividade completa (mobile-first)
- [ ] **5.5.5** — Botão de CTA que leva direto para `/auth/register`

---

### TASK 5.6 — E-mails Transacionais

**Subtasks:**

- [ ] **5.6.1** — Configurar Resend (ou SES) com domínio verificado
- [ ] **5.6.2** — Criar templates HTML de e-mail (responsivos) para:
  - Boas-vindas após registro
  - Confirmação de e-mail
  - Reset de senha
  - Convite de equipe
  - Alerta de manutenção vencida
  - Alerta de documento expirando
  - Trial expirando (dia 10, dia 13)
  - Relatório mensal IA (resumo + link)
  - Pagamento confirmado
  - Pagamento falhou
- [ ] **5.6.3** — Backend: `EmailService` com métodos tipados para cada template
- [ ] **5.6.4** — Envio assíncrono via fila BullMQ (não bloquear a request)

---

## 8. FASE 6 — POLISH, TESTES E LANÇAMENTO (Sprint 20)

> **Objetivo**: Refinar UX, garantir qualidade, corrigir bugs e preparar para abrir ao público.

---

### TASK 6.1 — Testes End-to-End

**Subtasks:**

- [ ] **6.1.1** — Configurar Playwright (ou Cypress) para testes E2E
- [ ] **6.1.2** — Escrever cenários E2E críticos:
  - Registro → Login → Cadastrar veículo → Registrar abastecimento → Ver dashboard
  - Criar plano de manutenção → Receber alerta → Criar OS → Fechar OS
  - Upgrade de plano via Stripe (test mode)
  - Fluxo de multa completo
- [ ] **6.1.3** — Integrar E2E no CI/CD (rodar em PR para main)

---

### TASK 6.2 — Performance e Otimização

**Subtasks:**

- [ ] **6.2.1** — Adicionar índices no Prisma para queries frequentes (listagens paginadas, filtros)
- [ ] **6.2.2** — Implementar cache Redis para endpoints pesados (dashboard, stats, TCO)
- [ ] **6.2.3** — Configurar compressão gzip/brotli no Nginx
- [ ] **6.2.4** — Configurar lazy loading de imagens no frontend
- [ ] **6.2.5** — Lighthouse audit: score > 90 em performance, accessibility, best practices
- [ ] **6.2.6** — Backend: response time < 200ms para listagens (p95), < 500ms para dashboards

---

### TASK 6.3 — Segurança Final

**Subtasks:**

- [ ] **6.3.1** — Audit de segurança: verificar todos os endpoints têm auth middleware
- [ ] **6.3.2** — Verificar que nenhum endpoint retorna dados de outro tenant
- [ ] **6.3.3** — Verificar que uploads são validados (tipo de arquivo, tamanho máximo)
- [ ] **6.3.4** — Configurar CORS restritivo em produção (apenas domínio do frontend)
- [ ] **6.3.5** — Configurar Content-Security-Policy headers
- [ ] **6.3.6** — Configurar rate limiting global e por endpoint sensível
- [ ] **6.3.7** — Revisar `.env` de produção — nenhuma secret hardcoded no código

---

### TASK 6.4 — Deploy e Infraestrutura de Produção

**Subtasks:**

- [ ] **6.4.1** — Configurar AWS RDS PostgreSQL (Multi-AZ para produção)
- [ ] **6.4.2** — Configurar AWS ElastiCache Redis
- [ ] **6.4.3** — Configurar AWS S3 + CloudFront para assets e uploads
- [ ] **6.4.4** — Configurar EC2 (ou ECS) com Docker para api e web
- [ ] **6.4.5** — Configurar domínio (frotaleve.com.br) com SSL (Let's Encrypt ou ACM)
- [ ] **6.4.6** — Configurar monitoramento: CloudWatch logs + alertas (CPU, memória, erros 5xx)
- [ ] **6.4.7** — Configurar backups automatizados do RDS (diário, retenção 30 dias)
- [ ] **6.4.8** — Testar disaster recovery: restaurar backup em ambiente de teste
- [ ] **6.4.9** — Configurar Sentry (ou similar) para error tracking no frontend e backend

---

### TASK 6.5 — Documentação Final

**Subtasks:**

- [ ] **6.5.1** — Revisar e completar documentação Swagger/OpenAPI de todos os endpoints
- [ ] **6.5.2** — Criar base de conhecimento (help center) com artigos:
  - Como cadastrar veículos
  - Como registrar abastecimento
  - Como configurar manutenção preventiva
  - Como usar o assistente IA
  - Como gerenciar usuários
  - Como exportar relatórios
  - FAQ
- [ ] **6.5.3** — Gravar vídeos curtos de tutorial (5 min cada) para os principais fluxos
- [ ] **6.5.4** — Criar página de "Status" (status.frotaleve.com.br) com uptime monitoring

---

## 9. PÓS-LANÇAMENTO — EVOLUÇÃO CONTÍNUA

> Tasks para depois do go-live, priorizadas por impacto.

### Backlog Priorizado

| Prioridade | Feature                           | Descrição                                        |
| :--------: | --------------------------------- | ------------------------------------------------ |
|     P1     | Integração WhatsApp               | Alertas via WhatsApp Business API                |
|     P1     | Integração Tabela FIPE            | Consulta automática para depreciação e renovação |
|     P1     | Integração Rastreadores GPS       | Importar km automático de Sascar, Cobli, etc.    |
|     P2     | Módulo de Viagens                 | Controle de viagens, adiantamentos, despesas     |
|     P2     | Controle de Portaria              | Registro de entrada/saída com tablet             |
|     P2     | Multi-empresa/filial              | Para plano Enterprise                            |
|     P2     | Integração ERP TOTVS Protheus     | Sincronização com módulos financeiro/compras     |
|     P3     | White-label                       | Personalização de marca para Enterprise          |
|     P3     | SSO (SAML/OIDC)                   | Para grandes empresas                            |
|     P3     | App nativo (React Native)         | Se PWA não atender requisitos específicos        |
|     P3     | Integração cartões de combustível | Ticket Log, Shell Box, TruckPag                  |
|     P4     | Módulo ESG                        | Relatório de emissões de CO2 da frota            |
|     P4     | Multi-idioma (Espanhol)           | Expansão LATAM                                   |
|     P4     | Marketplace de integrações        | Conectores com Zapier/n8n                        |

---

## 10. REFERÊNCIA RÁPIDA DE TASKS

### Total de Tasks por Fase

| Fase                                 | Sprints | Tasks  | Subtasks (aprox.) |
| ------------------------------------ | :-----: | :----: | :---------------: |
| **Fase 0** — Fundação                |   1-3   |   6    |        ~60        |
| **Fase 1** — Core MVP                |   4-8   |   7    |        ~55        |
| **Fase 2** — Módulos Operacionais    |  9-12   |   9    |        ~65        |
| **Fase 3** — Inteligência Artificial |  13-15  |   6    |        ~30        |
| **Fase 4** — Mobile                  |  16-17  |   2    |        ~15        |
| **Fase 5** — Billing e Go-to-Market  |  18-19  |   6    |        ~40        |
| **Fase 6** — Polish e Lançamento     |   20    |   5    |        ~30        |
| **TOTAL**                            | **20**  | **41** |     **~295**      |

### Dependências Críticas

```
0.1 Monorepo ──► 0.2 Backend ──► 0.3 Banco ──► 1.1 Auth Backend
                  0.4 Frontend ──────────────► 1.2 Auth Frontend
0.6 Shared Types ──► (todos os módulos)

1.1 Auth ──► 1.3 Veículos ──► 2.1 Combustível
                             ──► 2.2 Manutenção
                             ──► 2.3 Documentos
             1.5 Motoristas ──► 2.4 Multas
                             ──► 2.6 Sinistros

2.1 + 2.2 + 2.4 ──► 2.7 Financeiro/TCO
2.1 + 2.2 + 2.4 + 2.7 ──► 3.x IA (precisa de dados)

1.1 Auth ──► 4.x Mobile (consome mesma API)
5.1 Stripe ──► 6.4 Deploy Produção ──► LANÇAMENTO
```

---

> **Dica para o Claude Code**: Ao iniciar cada task, comece pedindo ao Claude Code para ler este ROADMAP.MD e o IDEIA.MD para ter contexto completo. Exemplo:
>
> ```
> "Leia os arquivos ROADMAP.MD e IDEIA.MD do projeto. Agora implemente a TASK 1.1 — Autenticação Backend, seguindo todas as subtasks listadas."
> ```

---

_Bora construir o Frota Leve! 🚛💨_
