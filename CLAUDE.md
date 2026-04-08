# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Frota Leve** (future brand: Frotafy) is a multi-tenant SaaS platform for fleet management, targeting Brazilian companies. See `IDEIA.MD` for full product vision and `ROADMAP.MD` for the detailed development plan (~295 subtasks across 6 phases).

## Architecture

TypeScript monorepo using **npm workspaces** + **Turborepo**. Node.js >= 20, npm >= 10.

```
apps/api         Express 4 + Prisma backend
apps/web         Angular 21 + PO-UI 21 frontend
apps/mobile      PWA placeholder (TASK 4.1)
packages/database  Prisma schema, migrations, seeds, Docker services
packages/shared    Enums, Zod DTOs, types, utils, constants — used by both api and web
packages/ai        AI integration placeholder (TASK 3.1)
```

**Path aliases** (defined in `tsconfig.base.json`):

- `@frota-leve/shared` → `packages/shared`
- `@frota-leve/database` → `packages/database`
- `@frota-leve/ai` → `packages/ai`

### API Module Pattern (`apps/api/src/modules/<feature>/`)

Each feature module follows this structure:

- `<feature>.routes.ts` — Express router with middleware chain
- `<feature>.controller.ts` — request handlers, extracts tenant/user context
- `<feature>.service.ts` — business logic, always scoped by `tenantId`
- `<feature>.validators.ts` — Zod schemas (imports shared DTOs from `@frota-leve/shared`)
- `<feature>.types.ts` — TypeScript types specific to the module

Middleware stack order in `apps/api/src/app.ts`: requestId → rateLimiter → morgan → body parsing → routes → errorHandler.

Auth flow: `authenticate` (JWT) → `tenantMiddleware` (loads tenant, checks status) → `authorize(...roles)` (RBAC).

### Angular Architecture (Standalone — Angular 21)

The frontend uses **standalone components** exclusively (Angular 21 default). There are **zero NgModules**.

**Rules:**

1. **No `standalone: true` needed** — it's the default in Angular 21. Never add `standalone: false`
2. **No NgModules** — use `*.routes.ts` with exported `Routes` arrays
3. **Component imports**: list all dependencies in `imports: [...]` in the `@Component` decorator
4. **Guards/Interceptors**: functional (`CanActivateFn`, `HttpInterceptorFn`), not class-based
5. **Signal APIs**: use `input()`, `output()`, `viewChild()` instead of decorators
6. **DI**: use `inject()`, not constructor parameters
7. **Bootstrap**: `bootstrapApplication()` with `provideRouter()` and `provideHttpClient(withInterceptors(...))`
8. **Lazy loading**: `loadChildren: () => import('./feature.routes').then(m => m.FEATURE_ROUTES)`

Frontend structure: `app/core/` (guards, interceptors, services), `app/features/` (lazy-loaded feature routes).

**Reference**: `docs/MIGRA-ANGULAR-BEST-PRACTICES.md`

## Build & Run Commands

All commands run from the **monorepo root**.

### Development

```bash
npm run dev                # All workspaces (api + web + services)
npm run dev:backend        # API + database services only
npm run services:up        # Start PostgreSQL + Redis containers
npm run services:down      # Stop containers
npm run services:logs      # Container logs
```

### Workspace-Specific

```bash
npm run dev --workspace=apps/api       # API only
npm run dev --workspace=apps/web       # Frontend only
npm test --workspace=packages/shared   # Test one package
npm run lint --workspace=apps/api      # Lint one workspace
```

### Database (Prisma)

```bash
npm run db:migrate -- --name <name>   # Create & run migration
npm run db:seed                        # Seed dev data
npm run db:reset                       # Reset DB + re-seed (destructive!)
npm run db:studio                      # Prisma Studio GUI
```

### Build, Test, Lint

```bash
npm run build              # Build all (turbo)
npm run test               # Test all (turbo)
npm run lint               # Lint all (turbo)
npm run type-check         # Type-check all (turbo)
npm run format             # Prettier format all
npm run format:check       # Prettier check (CI)
```

### Running a Single Test

```bash
# API unit test
cd apps/api && npx jest path/to/file.spec.ts

# API e2e test
cd apps/api && npx jest --config jest.e2e.config.cjs path/to/file.e2e-spec.ts

# Shared package test
cd packages/shared && npx jest path/to/file.spec.ts
```

### Docker (Production)

```bash
docker compose -f docker-compose.prod.yml up -d   # Full prod stack
```

## Conventions

### Language & Naming

- **TypeScript strict** across the entire monorepo
- **camelCase** for variables/functions, **PascalCase** for classes/interfaces/types, **UPPER_SNAKE_CASE** for constants and enums
- **kebab-case** for file names (e.g., `vehicle-list.component.ts`)
- **snake_case** for database tables and columns (Prisma `@map`)
- **kebab-case** for API URLs (e.g., `/api/v1/fuel-records`)
- Comments in **Portuguese** for business logic, **English** for infrastructure code
- Error messages in **Portuguese** (user-facing)

### Commits & Hooks

Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`

Pre-commit hook (`.husky/pre-commit`) runs:

1. **lint-staged** — ESLint fix + Prettier on staged `.ts/.tsx` files
2. **type-check on changed workspaces** — `tools/run-type-check-on-staged.mjs` intelligently checks only affected packages

### Branches

`feature/TASK-ID-descricao`, `fix/TASK-ID-descricao`

### Tests

Place `.spec.ts` files next to the file being tested. E2E tests use `.e2e-spec.ts`.

### Angular Conventions

- **Standalone by default**: Never use `standalone: false` or `@NgModule`
- **Signal APIs**: Use `input()`, `output()`, `viewChild()` — not `@Input`, `@Output`, `@ViewChild`
- **Functional Guards/Interceptors**: `CanActivateFn`, `HttpInterceptorFn`
- **File Naming**: `component.ts` (not `component.component.ts`)
- **Change Detection**: Prefer `ChangeDetectionStrategy.OnPush`

### ESLint Rules

- `@typescript-eslint/no-explicit-any`: **error** — no `any` allowed
- `@typescript-eslint/consistent-type-imports`: **warn** — use `import type` for type-only imports
- `no-console`: **warn** — use Winston logger instead
- Unused vars prefixed with `_` are allowed

## Multi-Tenancy (Critical)

Every database query and API endpoint MUST be scoped by `tenantId`. This is the most important architectural constraint:

- **API controllers**: Extract tenant context via `getActorContext(req)` which provides `tenantId`, plan, userId, IP, user-agent
- **API services**: Always include `where: { tenantId }` in Prisma queries
- **Middleware**: `tenantMiddleware` blocks requests for SUSPENDED/CANCELLED tenants
- **Plan enforcement**: Middleware checks tenant plan limits (max vehicles, max users, feature gates)
- **Never** allow cross-tenant data access
- Database uses `@@index([tenantId])` on all tenant-scoped tables

## Key Architectural Decisions

1. **Validation**: Zod schemas in `packages/shared/src/dtos/`, shared by frontend and backend. Backend validates via `validate(schema, target)` middleware.
2. **Error handling**: Custom error classes in `apps/api/src/shared/errors/` (`NotFoundError`, `ValidationError`, `ForbiddenError`, `PlanLimitError`, etc.). Standardized response: `{ success: boolean, data?, error?: { code, message, details } }`
3. **Auth**: JWT access token (15m) + refresh token (7d) with rotation. Refresh tokens blacklisted in Redis. Password hashing: bcryptjs with 12 salt rounds.
4. **Logging**: Winston with correlation ID per request. Human-readable in dev, JSON in prod. Silent in test.
5. **API responses**: Paginated lists return `{ data, meta: { page, limit, total, totalPages } }`.
6. **Environment config**: `apps/api/src/config/env.ts` validates all env vars with Zod at boot — process exits on missing required vars.

## ROADMAP Task Reference

Development follows this order of dependencies:

```
Monorepo → Backend → Database → Auth → Vehicles/Drivers →
Fuel/Maintenance/Documents/Fines/Tires/Incidents → Financial/TCO →
AI (Claude API) → Mobile PWA → Billing (Stripe) → Launch
```

When starting a task, read the corresponding section in `ROADMAP.MD` for detailed subtasks and acceptance criteria.
