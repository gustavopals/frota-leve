# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

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

**Path aliases** (`tsconfig.base.json`): `@frota-leve/shared`, `@frota-leve/database`, `@frota-leve/ai`

`@frota-leve/database` re-exports the Prisma client singleton (`prisma`) and all Prisma-generated types. Always import from this alias, never from `@prisma/client` directly.

### API Module Pattern (`apps/api/src/modules/<feature>/`)

- `<feature>.routes.ts` — Express router, wires middleware + controller methods
- `<feature>.controller.ts` — request handlers; each controller class defines a private `getActorContext(req)` returning `{ tenantId, tenantPlan, userId, ipAddress, userAgent }`
- `<feature>.service.ts` — business logic, always scoped by `tenantId`; check plan limits via `PLAN_LIMITS` from `@frota-leve/shared`
- `<feature>.validators.ts` — Zod schemas exported as both schema and inferred type (`type XInput = z.infer<typeof xSchema>`)
- `<feature>.types.ts` — module-specific types not in shared

**Middleware order**: `requestId → rateLimiter → morgan → body parsing → routes → errorHandler`

**Auth flow**: `authenticate` (JWT) → `tenantMiddleware` → `authorize(...roles)`

**`validate` middleware** usage in routes:

```ts
router.post('/', authenticate, tenantMiddleware, validate(createSchema, 'body'), controller.create);
```

**File uploads**: use the `upload` middleware from `src/middlewares/upload.ts` (multer). Several modules (vehicles, drivers, fines) support CSV/XLSX import via `POST /import?preview=true|false`.

**Background schedulers**: modules with time/mileage-based alerts (maintenance, documents, tires) have a `<feature>-alert.scheduler.ts` that runs on a daily interval. Start schedulers in `server.ts`.

**API base prefix**: all routes are under `/api/v1/`.

### Angular Architecture (Standalone — Angular 21)

Zero NgModules. All components are standalone by default.

- **No `standalone: true`** — default in Angular 21. Never add `standalone: false`
- **No NgModules** — use `*.routes.ts` with exported `Routes` arrays
- **Imports**: list all dependencies in `imports: [...]` in `@Component`
- **Guards/Interceptors**: functional (`CanActivateFn`, `HttpInterceptorFn`)
- **Signal APIs**: `input()`, `output()`, `viewChild()` — never `@Input`, `@Output`, `@ViewChild`
- **DI**: `inject()`, not constructor parameters
- **Lazy loading**: `loadChildren: () => import('./feature.routes').then(m => m.FEATURE_ROUTES)`
- **Change Detection**: prefer `ChangeDetectionStrategy.OnPush`

**Frontend feature structure** (`app/features/<feature>/`):

- `<feature>.routes.ts` — `Routes` array constant
- `<feature>.service.ts` — HTTP calls via `ApiService` (inject from `core/services/api`)
- `<feature>.types.ts`, `<feature>.constants.ts`, `<feature>.utils.ts` — domain types/data

**`ApiService`** (`core/services/api`) wraps all HTTP verbs. Use it for all API calls. Use `HttpClient` directly only for file uploads (FormData) and blob downloads.

**Interceptors** (wired in `app.config.ts`):

- `authInterceptor` — attaches `Authorization: Bearer <token>`
- `tenantInterceptor` — attaches tenant header
- `errorInterceptor` — global HTTP error handling

**Role-protected routes**: use `roleGuard` with `data: { roles: ['OWNER', 'ADMIN', ...] }`.

## Key Commands

```bash
npm run dev                        # All workspaces
npm run dev:backend                # API + DB services
npm run services:up/down           # PostgreSQL + Redis containers
npm run db:migrate -- --name <n>  # Create & run migration
npm run db:seed / db:reset         # Seed / reset DB
npm run build / test / type-check  # Full monorepo
```

Workspace-specific: `npm run <cmd> --workspace=apps/api`

Single test: `cd apps/api && npx jest path/to/file.spec.ts` (e2e: `--config jest.e2e.config.cjs`)

## Conventions

- **TypeScript strict** everywhere
- **camelCase** vars/functions, **PascalCase** classes/types, **UPPER_SNAKE_CASE** constants/enums
- **kebab-case** file names and API URLs, **snake_case** DB tables/columns
- Comments in **Portuguese** (business logic), **English** (infrastructure)
- Error messages in **Portuguese** (user-facing)
- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`
- Branches: `feature/TASK-ID-descricao`, `fix/TASK-ID-descricao`
- Tests: `.spec.ts` next to source, `.e2e-spec.ts` for e2e

### ESLint Rules

- `no-explicit-any`: **error** — no `any`
- `consistent-type-imports`: **warn** — use `import type`
- `no-console`: **warn** — use Winston logger

## Multi-Tenancy (Critical)

Every query and endpoint MUST be scoped by `tenantId`:

- **Controllers**: call `this.getActorContext(req)` → `{ tenantId, tenantPlan, userId, ... }`
- **Services**: always `where: { tenantId }` in Prisma queries
- **Never** allow cross-tenant data access
- All tenant-scoped tables have `@@index([tenantId])`

## Key Architectural Decisions

1. **Validation**: Zod schemas in `packages/shared/src/dtos/`, shared by api and web. Backend uses `validate(schema, target)` middleware.
2. **Error handling**: Custom classes in `apps/api/src/shared/errors/` (`NotFoundError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `PlanLimitError`, `TooManyRequestsError`). Response format: `{ success, data?, error?: { code, message, details } }`
3. **Auth**: JWT (15m) + refresh token (7d) with rotation, blacklisted in Redis. bcryptjs 12 rounds.
4. **Logging**: Winston with correlation ID. Human-readable dev, JSON prod, silent test.
5. **Pagination**: `{ data, meta: { page, limit, total, totalPages } }`
6. **Env config**: `apps/api/src/config/env.ts` validates all vars at boot via Zod.
7. **Plan limits**: `PLAN_LIMITS` from `@frota-leve/shared` maps `PlanType` → `{ maxVehicles, maxUsers, hasAI, hasAPI, hasTires }`. Services must enforce these before creating resources, throwing `PlanLimitError`.

## User Roles

`OWNER > ADMIN > MANAGER > OPERATOR > DRIVER > FINANCIAL > VIEWER`

Role authorization in routes: `authorize('OWNER', 'ADMIN')`. Frontend guards: `data: { roles: [...] }` with `roleGuard`.

## ROADMAP Task Reference

```
Monorepo → Backend → Database → Auth → Vehicles/Drivers →
Fuel/Maintenance/Documents/Fines/Tires/Incidents → Financial/TCO →
AI (Codex API) → Mobile PWA → Billing (Stripe) → Launch
```

When starting a task, read the corresponding section in `ROADMAP.MD` for subtasks and acceptance criteria.
