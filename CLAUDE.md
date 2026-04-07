# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Frota Leve** (future brand: Frotafy) is a multi-tenant SaaS platform for fleet management, targeting Brazilian companies. See `IDEIA.MD` for full product vision and `ROADMAP.MD` for the detailed development plan (~295 subtasks across 6 phases).

## Current State

The project is being **restructured**. The `main` branch contains an initial implementation with NestJS + Angular + Tailwind CSS. The `ROADMAP.MD` defines a new architecture using Express + Angular + PO-UI + Turborepo monorepo. When implementing, follow the ROADMAP unless explicitly told otherwise.

### Existing code (main branch)

- **Backend**: NestJS + Prisma + PostgreSQL (`backend/`)
- **Frontend**: Angular 18 + Tailwind CSS + Capacitor (`frontend/`)
- Modules already scaffolded: auth, vehicles, fuel, maintenance, checklist, tenants, users

### Target architecture (per ROADMAP)

- **Monorepo**: Turborepo with `apps/web`, `apps/api`, `apps/mobile`, `packages/shared`, `packages/database`, `packages/ai`
- **Backend**: Node.js + Express + Prisma + PostgreSQL + Redis
- **Frontend**: Angular 21 with PO-UI (TOTVS design system) — **Standalone Components** (see below)
- **Mobile**: Angular PWA (offline-first)
- **AI**: Claude API integration (`packages/ai`)
- **Payments**: Stripe Billing

### Angular Migration: NgModules → Standalone Components

⚠️ **CRITICAL**: As of 2026-04-07, the frontend is transitioning from **NgModules to Standalone Components** (Angular 21 best practice).

**Current Status:**

- ✅ Architecture planned in `docs/MIGRA-ANGULAR-BEST-PRACTICES.md`
- ⏳ Migration in progress (Phases 1-5 over 6 sprints)
- **IMPORTANT**: All NEW code must be **standalone-first**

**Rules for Code Generation:**

1. **Components**: Always use `standalone: true`

   ```typescript
   @Component({
     selector: 'app-my-component',
     standalone: true,  // ← Required
     imports: [CommonModule, PoModule, ...],
     templateUrl: './my-component.html',
   })
   export class MyComponent {}
   ```

2. **No `@NgModule` for new code** — Use standalone + routes arrays

   ```typescript
   // ❌ DON'T: Create new NgModules
   @NgModule({
     declarations: [...],
     imports: [...],
   })
   export class MyModule {}

   // ✅ DO: Use routes + standalone components
   export const MY_ROUTES: Routes = [{
     path: '',
     component: MyComponent,
     providers: [MyService],
   }];
   ```

3. **Route Guards**: Use function-based, not class-based

   ```typescript
   // ✅ Correct (Angular 21+)
   export const authGuard = () => {
     const authService = inject(AuthService);
     return authService.isAuthenticated();
   };
   ```

4. **Dependency Injection**: Use `inject()` in components, not constructor parameters

   ```typescript
   // ✅ Preferred
   export class MyComponent {
     private readonly service = inject(MyService);
   }
   ```

5. **Shared Code**: Import components/pipes directly, not from `SharedModule`

   ```typescript
   // ✅ Correct
   @Component({
     imports: [CommonModule, PoModule, CustomPipe, SharedComponent],
   })

   // ❌ Wrong
   @Component({
     imports: [SharedModule],
   })
   ```

**Reference Documentation:**

- 📖 Full migration guide: `docs/MIGRA-ANGULAR-BEST-PRACTICES.md`
- 📖 Post-migration patterns: Will be in `docs/ANGULAR-PATTERNS.md` (Phase 5)
- 📖 Official Angular docs: https://angular.io/guide/standalone-components

## Build & Run Commands

### Backend (current - NestJS)

```bash
cd backend
npm run start:dev          # Dev server with watch
npm run build              # Production build
npm run test               # Unit tests (Jest)
npm run test:e2e           # E2E tests
npm run lint               # ESLint
npx prisma migrate dev     # Run migrations
npx prisma migrate dev --name <name>  # Create migration
npx prisma generate        # Generate Prisma client
npx prisma studio          # DB GUI
npm run seed               # Seed database (ts-node prisma/seed.ts)
```

### Frontend (current - Angular)

```bash
cd frontend
npm start                  # Dev server (ng serve)
npm run build              # Production build
npm test                   # Unit tests
```

### Docker (PostgreSQL + pgAdmin)

```bash
npm run docker:up          # Start containers (from root)
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

### Commits

Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`

### Branches

`feature/TASK-ID-descricao`, `fix/TASK-ID-descricao`

### Tests

Place `.spec.ts` files next to the file being tested.

### Angular Conventions

- **Standalone First**: All new Angular components/directives/pipes must have `standalone: true`
- **Imports in Decorator**: Explicitly list all dependencies in `imports: [...]`
- **Routes as Arrays**: Export `Routes` arrays (e.g., `export const MY_ROUTES: Routes = [...]`), NOT modules
- **Lazy Loading**: Use `loadChildren: () => import(...).then(m => m.MY_ROUTES)`
- **Change Detection**: Prefer `ChangeDetectionStrategy.OnPush` with standalone
- **No SharedModule**: Delete feature `*-module.ts` files — components are self-contained
- **File Naming**: `component.ts` (not `component.component.ts` unless multiple components in one folder)

## Multi-Tenancy (Critical)

Every database query and API endpoint MUST be scoped by `tenantId`. This is the most important architectural constraint:

- **Backend controllers**: Always extract `tenantId` from the authenticated user context
- **Backend services**: Always include `where: { tenantId }` in Prisma queries
- **Never** allow cross-tenant data access
- Database uses `@@index([tenantId])` on all tenant-scoped tables

## Key Architectural Decisions

1. **Validation**: zod on backend for DTO validation; shared schemas in `packages/shared` (target). Current code uses `class-validator` (NestJS).
2. **Error handling**: Custom `AppError` with code, message, and HTTP status. Standardized response: `{ success: boolean, data?, error?: { code, message, details } }`
3. **Auth**: JWT + Refresh Token with rotation. Refresh tokens blacklisted in Redis.
4. **Logging**: Winston with levels (error, warn, info, debug) and correlation ID per request.
5. **API responses**: Paginated lists return `{ data, meta: { page, limit, total, totalPages } }`.
6. **Plan enforcement**: Middleware checks tenant plan limits (max vehicles, max users, feature gates) before allowing operations.

## ROADMAP Task Reference

Development follows this order of dependencies:

```
Monorepo → Backend → Database → Auth → Vehicles/Drivers →
Fuel/Maintenance/Documents/Fines/Tires/Incidents → Financial/TCO →
AI (Claude API) → Mobile PWA → Billing (Stripe) → Launch
```

When starting a task, read the corresponding section in `ROADMAP.MD` for detailed subtasks and acceptance criteria.
