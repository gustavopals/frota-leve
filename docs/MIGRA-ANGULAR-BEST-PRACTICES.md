# Migracao Angular 21: Modernizacao Completa

**Status**: Concluido
**Angular**: 21.2.0 | **PO-UI**: 21.8.0
**Escopo**: 24 componentes, 33 arquivos para deletar, 5 conversoes de infraestrutura

---

## O Que Muda

No Angular 21, componentes sao **standalone por padrao**. Nao existe `standalone: true` — ele ja e o comportamento natural. Nosso codigo usa `standalone: false` em 24 lugares, forcando o padrao antigo. Alem disso, guards, interceptors e inputs/outputs tem APIs novas mais simples.

### Resumo das Mudancas

| Padrao Antigo (atual)                              | Padrao Angular 21                          | Arquivos afetados     |
| -------------------------------------------------- | ------------------------------------------ | --------------------- |
| `@NgModule` + `declarations`                       | Deletar — componente importa direto        | 33 arquivos deletados |
| `standalone: false`                                | Remover a linha (default e standalone)     | 24 componentes        |
| `class AuthGuard implements CanActivate`           | `const authGuard: CanActivateFn`           | 2 guards              |
| `class AuthInterceptor implements HttpInterceptor` | `const authInterceptor: HttpInterceptorFn` | 3 interceptors        |
| `@Input()` / `@Output()` / `@ViewChild()`          | `input()` / `output()` / `viewChild()`     | 3 componentes         |
| `platformBrowser().bootstrapModule()`              | `bootstrapApplication()`                   | main.ts               |
| `RouterModule.forRoot()`                           | `provideRouter()`                          | app.routes.ts         |

---

## Ordem de Execucao

```
Passo 1: Bootstrap (main.ts + app.ts + app.routes.ts)
    ↓
Passo 2: Interceptors → funcionais
    ↓
Passo 3: Guards → funcionais
    ↓
Passo 4: Layout (MainLayout + AuthLayout)
    ↓
Passo 5: Shared (FeaturePlaceholder) + deletar CoreModule
    ↓
Passo 6: Features — todas de uma vez (mecanico)
    ↓
Passo 7: Signal APIs (input/output/viewChild)
    ↓
Passo 8: Validacao final
```

> **Regra**: cada passo termina com `npm run build` passando. Se quebrar, corrige antes de avancar.

---

## Passo 1: Bootstrap

### 1.1 Criar `app.routes.ts`

Extrair as rotas de `app-routing-module.ts` para um array exportado.

**Criar** `apps/web/src/app/app.routes.ts`:

```typescript
import type { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import { roleGuard } from './core/guards/role-guard';
import { MainLayout } from './layout/main-layout/main-layout';

export const APP_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '',
    component: MainLayout,
    canActivateChild: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'onboarding',
        loadChildren: () =>
          import('./features/onboarding/onboarding.routes').then((m) => m.ONBOARDING_ROUTES),
      },
      {
        path: 'vehicles',
        loadChildren: () =>
          import('./features/vehicles/vehicles.routes').then((m) => m.VEHICLES_ROUTES),
      },
      {
        path: 'drivers',
        loadChildren: () =>
          import('./features/drivers/drivers.routes').then((m) => m.DRIVERS_ROUTES),
      },
      {
        path: 'fuel',
        loadChildren: () => import('./features/fuel/fuel.routes').then((m) => m.FUEL_ROUTES),
      },
      {
        path: 'maintenance',
        loadChildren: () =>
          import('./features/maintenance/maintenance.routes').then((m) => m.MAINTENANCE_ROUTES),
      },
      {
        path: 'tires',
        loadChildren: () => import('./features/tires/tires.routes').then((m) => m.TIRES_ROUTES),
      },
      {
        path: 'fines',
        loadChildren: () => import('./features/fines/fines.routes').then((m) => m.FINES_ROUTES),
      },
      {
        path: 'documents',
        loadChildren: () =>
          import('./features/documents/documents.routes').then((m) => m.DOCUMENTS_ROUTES),
      },
      {
        path: 'incidents',
        loadChildren: () =>
          import('./features/incidents/incidents.routes').then((m) => m.INCIDENTS_ROUTES),
      },
      {
        path: 'financial',
        canActivate: [roleGuard],
        data: { roles: ['OWNER', 'ADMIN', 'FINANCIAL'] },
        loadChildren: () =>
          import('./features/financial/financial.routes').then((m) => m.FINANCIAL_ROUTES),
      },
      {
        path: 'reports',
        loadChildren: () =>
          import('./features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
      },
      {
        path: 'ai-assistant',
        loadChildren: () =>
          import('./features/ai-assistant/ai-assistant.routes').then((m) => m.AI_ASSISTANT_ROUTES),
      },
      {
        path: 'settings',
        canActivate: [roleGuard],
        data: { roles: ['OWNER', 'ADMIN'] },
        loadChildren: () =>
          import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
      {
        path: '**',
        redirectTo: 'dashboard',
      },
    ],
  },
];
```

### 1.2 Converter `app.ts`

**Antes:**

```typescript
@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.scss',
})
export class App {
  private readonly poThemeService = inject(PoThemeService);
  // ...
}
```

**Depois:**

```typescript
import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PoThemeService } from '@po-ui/ng-components';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly poThemeService = inject(PoThemeService);
  protected readonly title = signal('Frota Leve');

  constructor() {
    this.poThemeService.setDensityMode('small');
  }
}
```

> Sem `standalone: false` e sem `standalone: true`. No Angular 21, standalone e o default.

### 1.3 Converter `main.ts`

**Antes:**

```typescript
import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app-module';

platformBrowser()
  .bootstrapModule(AppModule)
  .catch((error: unknown) => {
    queueMicrotask(() => {
      throw error;
    });
  });
```

**Depois:**

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { App } from './app/app';
import { APP_ROUTES } from './app/app.routes';
import { authInterceptor } from './app/core/interceptors/auth-interceptor';
import { tenantInterceptor } from './app/core/interceptors/tenant-interceptor';
import { errorInterceptor } from './app/core/interceptors/error-interceptor';

bootstrapApplication(App, {
  providers: [
    provideRouter(APP_ROUTES, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(withInterceptors([authInterceptor, tenantInterceptor, errorInterceptor])),
    provideAnimations(),
  ],
}).catch((error: unknown) => {
  queueMicrotask(() => {
    throw error;
  });
});
```

### 1.4 Deletar

```bash
rm apps/web/src/app/app-module.ts
rm apps/web/src/app/app-routing-module.ts
```

### 1.5 Validar

```bash
npm run build   # deve compilar
npm run test    # deve passar
```

---

## Passo 2: Interceptors Funcionais

Os 3 interceptors mudam de **classe com interface** para **funcao pura**. A API funcional usa `HttpInterceptorFn` em vez de `HttpInterceptor`, e `HttpHandlerFn` em vez de `HttpHandler`.

### 2.1 Auth Interceptor

**Antes** (`core/interceptors/auth-interceptor.ts`):

```typescript
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private readonly authService: AuthService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const accessToken = this.authService.getAccessToken();
    if (!accessToken) {
      return next.handle(request);
    }
    return next.handle(request.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } }));
  }
}
```

**Depois:**

```typescript
import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const accessToken = inject(AuthService).getAccessToken();

  if (!accessToken) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } }));
};
```

### 2.2 Tenant Interceptor

**Depois** (`core/interceptors/tenant-interceptor.ts`):

```typescript
import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth';

export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const tenantId = inject(AuthService).getTenantId();

  if (!tenantId) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { 'X-Tenant-Id': tenantId } }));
};
```

### 2.3 Error Interceptor

**Depois** (`core/interceptors/error-interceptor.ts`):

```typescript
import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth';
import { NotificationService } from '../services/notification';

function resolveClientErrorMessage(error: HttpErrorResponse): string {
  if (typeof error.error === 'string' && error.error.trim()) {
    return error.error;
  }

  if (typeof error.error === 'object' && error.error) {
    if ('message' in error.error) {
      const message = error.error.message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }

    if (
      'error' in error.error &&
      typeof error.error.error === 'object' &&
      error.error.error &&
      'message' in error.error.error
    ) {
      const message = error.error.error.message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }
  }

  return 'Nao foi possivel concluir a operacao solicitada.';
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const notificationService = inject(NotificationService);
  const isAuthRequest =
    /\/auth\/(login|register|forgot-password|reset-password|refresh)(?:\?|$)/.test(req.url);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      if (error.status === 401) {
        if (!isAuthRequest && authService.isAuthenticated()) {
          authService.logout();
          notificationService.warning('Sua sessao expirou. Faca login novamente.');
          return throwError(() => error);
        }

        notificationService.warning(resolveClientErrorMessage(error));
        return throwError(() => error);
      }

      if (error.status >= 500) {
        notificationService.error('O servidor nao respondeu como esperado. Tente novamente.');
      } else if (error.status >= 400) {
        notificationService.warning(resolveClientErrorMessage(error));
      }

      return throwError(() => error);
    }),
  );
};
```

---

## Passo 3: Guards Funcionais

### 3.1 Auth Guard

**Antes** (`core/guards/auth-guard.ts`):

```typescript
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate, CanActivateChild {
  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {}
  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree { ... }
  canActivateChild(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree { ... }
}
```

**Depois:**

```typescript
import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url },
  });
};
```

> `CanActivateFn` serve tanto para `canActivate` quanto para `canActivateChild`.

### 3.2 Role Guard

**Depois** (`core/guards/role-guard.ts`):

```typescript
import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { NotificationService } from '../services/notification';

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const notificationService = inject(NotificationService);
  const router = inject(Router);
  const roles = route.data['roles'];

  if (!Array.isArray(roles) || roles.length === 0 || authService.hasAnyRole(roles)) {
    return true;
  }

  notificationService.warning('Seu perfil atual nao possui acesso a esta area.');
  return router.createUrlTree(['/dashboard']);
};
```

---

## Passo 4: Layout

### 4.1 MainLayout

**Antes:**

```typescript
@Component({
  selector: 'app-main-layout',
  standalone: false,
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  constructor(private readonly authService: AuthService) {}
  // ...
}
```

**Depois:**

```typescript
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PoMenuModule, PoToolbarModule } from '@po-ui/ng-components';
import type { PoMenuItem, PoToolbarAction, PoToolbarProfile } from '@po-ui/ng-components';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, PoToolbarModule, PoMenuModule],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  private readonly authService = inject(AuthService);

  protected readonly appName = environment.appName;
  protected readonly appVersion = environment.version;
  protected readonly menus: PoMenuItem[] = [
    /* ... sem mudanca ... */
  ];

  // ... resto igual, mas trocando constructor injection por inject()
}
```

> O template usa `po-toolbar`, `po-menu` e `router-outlet`. Entao importa so `PoToolbarModule`, `PoMenuModule` e `RouterOutlet`.

### 4.2 AuthLayout

**Depois:**

```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.scss',
})
export class AuthLayout {
  protected readonly appName = environment.appName;
}
```

> O template so usa `router-outlet` e interpolacao `{{ }}`. Nao precisa de nenhum modulo PO-UI.

### 4.3 Deletar

```bash
rm apps/web/src/app/layout/layout-module.ts
```

---

## Passo 5: Shared + Core

### 5.1 FeaturePlaceholder

**Antes:**

```typescript
@Component({
  selector: 'app-feature-placeholder',
  standalone: false,
  templateUrl: './feature-placeholder.html',
  styleUrl: './feature-placeholder.scss',
})
export class FeaturePlaceholder {
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
  @Input() description = '';
  @Input() eyebrow = 'Setup base';
}
```

**Depois (com signal inputs):**

```typescript
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-feature-placeholder',
  templateUrl: './feature-placeholder.html',
  styleUrl: './feature-placeholder.scss',
})
export class FeaturePlaceholder {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly description = input('');
  readonly eyebrow = input('Setup base');
}
```

> **Atencao**: no template, `@Input` acessa como `title`, signal input acessa como `title()`. Entao o template precisa mudar de `{{ title }}` para `{{ title() }}`.

### 5.2 Deletar

```bash
rm apps/web/src/app/shared/shared-module.ts
rm apps/web/src/app/core/core-module.ts
```

---

## Passo 6: Features (Batch)

Todas as 15 features seguem o **mesmo padrao mecanico**. Para cada feature:

1. Abrir componente(s) → remover `standalone: false`, adicionar `imports: [...]`
2. Criar `*.routes.ts` com as rotas do routing-module
3. Deletar `*-module.ts` e `*-routing-module.ts`

### 6.1 Template: Feature Simples (placeholder)

10 features sao placeholders identicos (1 pagina que usa `FeaturePlaceholder`):
`dashboard`, `drivers`, `fuel`, `maintenance`, `tires`, `fines`, `documents`, `incidents`, `financial`, `reports`, `settings`, `ai-assistant`, `onboarding`.

**Componente — antes:**

```typescript
@Component({
  selector: 'app-dashboard-page',
  standalone: false,
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage { ... }
```

**Componente — depois:**

```typescript
import { Component } from '@angular/core';
import { FeaturePlaceholder } from '../../../../shared/components/feature-placeholder/feature-placeholder';
// + qualquer outro import PO-UI que o template use

@Component({
  selector: 'app-dashboard-page',
  imports: [FeaturePlaceholder],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage { ... }
```

**Criar routes — antes (2 arquivos):**

```typescript
// dashboard-module.ts — DELETAR
@NgModule({
  declarations: [DashboardPage],
  imports: [SharedModule, DashboardRoutingModule],
})
export class DashboardModule {}

// dashboard-routing-module.ts — DELETAR
const routes: Routes = [{ path: '', component: DashboardPage }];
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DashboardRoutingModule {}
```

**Criar routes — depois (1 arquivo):**

```typescript
// dashboard.routes.ts — CRIAR
import type { Routes } from '@angular/router';
import { DashboardPage } from './pages/dashboard-page/dashboard-page';

export const DASHBOARD_ROUTES: Routes = [{ path: '', component: DashboardPage }];
```

**Deletar:**

```bash
rm apps/web/src/app/features/dashboard/dashboard-module.ts
rm apps/web/src/app/features/dashboard/dashboard-routing-module.ts
```

### 6.2 Template: Auth (4 paginas + layout proprio)

**Criar** `features/auth/auth.routes.ts`:

```typescript
import type { Routes } from '@angular/router';
import { AuthLayout } from '../../layout/auth-layout/auth-layout';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    component: AuthLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'login' },
      {
        path: 'login',
        loadComponent: () => import('./pages/login-page/login-page').then((m) => m.LoginPage),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./pages/register-page/register-page').then((m) => m.RegisterPage),
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./pages/forgot-password-page/forgot-password-page').then(
            (m) => m.ForgotPasswordPage,
          ),
      },
      {
        path: 'reset-password',
        loadComponent: () =>
          import('./pages/reset-password-page/reset-password-page').then(
            (m) => m.ResetPasswordPage,
          ),
      },
    ],
  },
];
```

> Usando `loadComponent` em vez de `component` para lazy load de cada pagina individualmente. Melhora o bundle split.

**Converter cada pagina auth** (ex: LoginPage):

```typescript
import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PoButtonModule, PoFieldModule, PoPageModule } from '@po-ui/ng-components';
import { AuthService } from '../../../../core/services/auth';
// ...

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, PoFieldModule, PoButtonModule, PoPageModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage { ... }
```

**Deletar:**

```bash
rm apps/web/src/app/features/auth/auth-module.ts
rm apps/web/src/app/features/auth/auth-routing-module.ts
```

### 6.3 Template: Vehicles (modulo mais complexo)

**Criar** `features/vehicles/vehicles.routes.ts`:

```typescript
import type { Routes } from '@angular/router';
import { VehiclesPage } from './pages/vehicles-page/vehicles-page';

export const VEHICLES_ROUTES: Routes = [
  { path: '', component: VehiclesPage },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/vehicle-form-page/vehicle-form-page').then((m) => m.VehicleFormPage),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./pages/vehicle-form-page/vehicle-form-page').then((m) => m.VehicleFormPage),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/vehicle-detail-page/vehicle-detail-page').then((m) => m.VehicleDetailPage),
  },
];
```

**Converter VehiclesPage** — imports baseados no template real:

```typescript
@Component({
  selector: 'app-vehicles-page',
  imports: [
    DecimalPipe,                    // {{ stats.averageFleetAge | number: '1.0-1' }}
    ReactiveFormsModule,            // [formGroup], formControlName
    PoPageModule,                   // po-page-list
    PoWidgetModule,                 // po-widget
    PoFieldModule,                  // po-input, po-combo, po-select
    PoButtonModule,                 // po-button
    PoTableModule,                  // po-table
    PoModalModule,                  // po-modal
    VehicleImportModal,             // app-vehicle-import-modal
  ],
  templateUrl: './vehicles-page.html',
  styleUrl: './vehicles-page.scss',
})
export class VehiclesPage { ... }
```

> `DecimalPipe` vem de `@angular/common` e substitui a necessidade de importar `CommonModule` inteiro. Os `@if` e `@for` no template funcionam sem nenhum import (sao built-in no Angular 17+).

**Converter VehicleImportModal:**

```typescript
@Component({
  selector: 'app-vehicle-import-modal',
  imports: [
    DecimalPipe,
    PoModalModule,
    PoTableModule,
    PoButtonModule,
    PoFieldModule,        // po-upload
    PoInfoModule,
    PoNotificationModule,
  ],
  templateUrl: './vehicle-import-modal.html',
  styleUrl: './vehicle-import-modal.scss',
})
export class VehicleImportModal { ... }
```

**Deletar:**

```bash
rm apps/web/src/app/features/vehicles/vehicles-module.ts
rm apps/web/src/app/features/vehicles/vehicles-routing-module.ts
```

### 6.4 Como saber quais PO-UI modules importar

Olhe o template HTML do componente e mapeie:

| Componente no template                                                           | Modulo PO-UI           |
| -------------------------------------------------------------------------------- | ---------------------- |
| `po-page-list`, `po-page-default`, `po-page-edit`, `po-page-detail`              | `PoPageModule`         |
| `po-table`                                                                       | `PoTableModule`        |
| `po-modal`                                                                       | `PoModalModule`        |
| `po-button`                                                                      | `PoButtonModule`       |
| `po-input`, `po-combo`, `po-select`, `po-upload`, `po-textarea`, `po-datepicker` | `PoFieldModule`        |
| `po-widget`                                                                      | `PoWidgetModule`       |
| `po-toolbar`                                                                     | `PoToolbarModule`      |
| `po-menu`                                                                        | `PoMenuModule`         |
| `po-tabs`, `po-tab`                                                              | `PoTabsModule`         |
| `po-tag`                                                                         | `PoTagModule`          |
| `po-info`                                                                        | `PoInfoModule`         |
| `po-divider`                                                                     | `PoDividerModule`      |
| `po-dialog`                                                                      | `PoDialogModule`       |
| `po-notification`                                                                | `PoNotificationModule` |

| Diretiva/Pipe no template                  | Import                                               |
| ------------------------------------------ | ---------------------------------------------------- |
| `@if`, `@for`, `@switch`                   | Nenhum (built-in Angular 17+)                        |
| `{{ x \| number }}`, `{{ x \| currency }}` | `DecimalPipe` ou `CurrencyPipe` de `@angular/common` |
| `{{ x \| date }}`                          | `DatePipe` de `@angular/common`                      |
| `{{ x \| async }}`                         | `AsyncPipe` de `@angular/common`                     |
| `[ngClass]`, `[ngStyle]`                   | `NgClass` ou `NgStyle` de `@angular/common`          |
| `[formGroup]`, `formControlName`           | `ReactiveFormsModule` de `@angular/forms`            |
| `[(ngModel)]`                              | `FormsModule` de `@angular/forms`                    |
| `router-outlet`, `[routerLink]`            | `RouterOutlet`, `RouterLink` de `@angular/router`    |

---

## Passo 7: Signal APIs

### 7.1 `input()` substitui `@Input()`

**Onde**: `FeaturePlaceholder` (ja feito no Passo 5)

**Regra no template**: `{{ title }}` muda para `{{ title() }}` (signal e uma funcao).

### 7.2 `output()` substitui `@Output() + EventEmitter`

**Onde**: `VehicleImportModal`

**Antes:**

```typescript
import { EventEmitter, Output } from '@angular/core';

@Output() readonly completed = new EventEmitter<void>();

// Emitir:
this.completed.emit();
```

**Depois:**

```typescript
import { output } from '@angular/core';

readonly completed = output<void>();

// Emitir:
this.completed.emit();
```

> A chamada `emit()` funciona igual. O template `(completed)="..."` nao muda.

### 7.3 `viewChild()` substitui `@ViewChild()`

**Onde**: `VehiclesPage`, `VehicleImportModal`

**Antes:**

```typescript
import { ViewChild } from '@angular/core';

@ViewChild('statusModal', { static: true }) private readonly statusModal?: PoModalComponent;
@ViewChild(VehicleImportModal, { static: true }) private readonly importModal?: VehicleImportModal;
```

**Depois:**

```typescript
import { viewChild } from '@angular/core';

private readonly statusModal = viewChild.required<PoModalComponent>('statusModal');
private readonly importModal = viewChild.required<VehicleImportModal>(VehicleImportModal);
```

> `viewChild()` retorna um signal. Acesso muda de `this.statusModal?.open()` para `this.statusModal().open()`.

---

## Passo 8: Validacao Final

### 8.1 Verificar que nao sobrou nada antigo

```bash
# Nenhum NgModule no codigo (exceto node_modules)
grep -rn "@NgModule" apps/web/src/app/
# Esperado: zero resultados

# Nenhum standalone: false
grep -rn "standalone: false" apps/web/src/app/
# Esperado: zero resultados

# Nenhum module file
find apps/web/src/app -name "*-module.ts"
# Esperado: zero resultados

# Nenhum @Input/@Output/@ViewChild (exceto se PO-UI exigir)
grep -rn "@Input\|@Output\|@ViewChild" apps/web/src/app/ --include="*.ts"
# Esperado: zero resultados (ou apenas em arquivos que PO-UI exige)
```

### 8.2 Build e testes

```bash
npm run build                # deve compilar limpo
npm run test                 # testes devem passar
npm run lint                 # sem warnings novos
```

### 8.3 Teste manual

- [ ] Login funciona
- [ ] Redirect para dashboard apos login
- [ ] Menu lateral navega para todas as rotas
- [ ] Tela de veiculos carrega, filtra, exporta
- [ ] Formulario de veiculo salva
- [ ] Importacao de veiculos funciona
- [ ] Alteracao de status funciona
- [ ] Logout redireciona para login
- [ ] Rota protegida redireciona usuario sem permissao
- [ ] Rota inexistente redireciona para dashboard

---

## Arquivos: Resumo de Acoes

### Criar (17 arquivos)

| Arquivo                                        | Conteudo                    |
| ---------------------------------------------- | --------------------------- |
| `app.routes.ts`                                | Array de rotas da aplicacao |
| `features/auth/auth.routes.ts`                 | Rotas do auth               |
| `features/dashboard/dashboard.routes.ts`       | Rotas do dashboard          |
| `features/vehicles/vehicles.routes.ts`         | Rotas de veiculos           |
| `features/drivers/drivers.routes.ts`           | Rotas de motoristas         |
| `features/fuel/fuel.routes.ts`                 | Rotas de combustivel        |
| `features/maintenance/maintenance.routes.ts`   | Rotas de manutencao         |
| `features/tires/tires.routes.ts`               | Rotas de pneus              |
| `features/fines/fines.routes.ts`               | Rotas de multas             |
| `features/documents/documents.routes.ts`       | Rotas de documentos         |
| `features/incidents/incidents.routes.ts`       | Rotas de sinistros          |
| `features/financial/financial.routes.ts`       | Rotas do financeiro         |
| `features/reports/reports.routes.ts`           | Rotas de relatorios         |
| `features/ai-assistant/ai-assistant.routes.ts` | Rotas do assistente IA      |
| `features/settings/settings.routes.ts`         | Rotas de configuracoes      |
| `features/onboarding/onboarding.routes.ts`     | Rotas do onboarding         |

### Editar (29 arquivos)

| Arquivo                    | Mudanca                                                                           |
| -------------------------- | --------------------------------------------------------------------------------- |
| `main.ts`                  | `bootstrapApplication()` + providers                                              |
| `app.ts`                   | Remover `standalone: false`, add `imports: [RouterOutlet]`                        |
| 3x interceptors            | Classe → funcao                                                                   |
| 2x guards                  | Classe → funcao                                                                   |
| `main-layout.ts`           | Remover `standalone: false`, add imports PO-UI                                    |
| `auth-layout.ts`           | Remover `standalone: false`, add `imports: [RouterOutlet]`                        |
| `feature-placeholder.ts`   | Remover `standalone: false`, `@Input` → `input()`                                 |
| `feature-placeholder.html` | `{{ title }}` → `{{ title() }}`                                                   |
| 4x paginas auth            | Remover `standalone: false`, add imports PO-UI + Forms                            |
| 3x paginas vehicles        | Remover `standalone: false`, add imports PO-UI + Forms                            |
| `vehicle-import-modal.ts`  | Remover `standalone: false`, `@Output` → `output()`, `@ViewChild` → `viewChild()` |
| 10x paginas placeholder    | Remover `standalone: false`, add `imports: [FeaturePlaceholder]`                  |

### Deletar (33 arquivos)

| Tipo                            | Quantidade |
| ------------------------------- | ---------- |
| `*-module.ts` (feature modules) | 15         |
| `*-routing-module.ts`           | 15         |
| `app-module.ts`                 | 1          |
| `app-routing-module.ts`         | 1          |
| `shared-module.ts`              | 1          |
| `core-module.ts`                | 1          |
| `layout-module.ts`              | 1          |
| **Total deletados**             | **33**     |

---

## Resultado Final

Depois da migracao, a estrutura de uma feature fica assim:

```
features/vehicles/
├── vehicles.routes.ts              ← 15 linhas, export const
├── vehicles.service.ts             ← sem mudanca
├── vehicles.types.ts               ← sem mudanca
├── vehicles.constants.ts           ← sem mudanca
├── vehicles.utils.ts               ← sem mudanca
├── pages/
│   ├── vehicles-page/
│   │   ├── vehicles-page.ts        ← imports direto no decorator
│   │   ├── vehicles-page.html      ← sem mudanca
│   │   └── vehicles-page.scss      ← sem mudanca
│   ├── vehicle-form-page/
│   └── vehicle-detail-page/
└── components/
    └── vehicle-import-modal/
```

**Nenhum module. Nenhum routing-module. Cada componente sabe o que precisa.**
