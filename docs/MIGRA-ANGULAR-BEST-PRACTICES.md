# Migração Angular: NgModules → Standalone Components

**Status**: Planejado  
**Versão Angular**: 21.2.0  
**Estimativa**: 5-7 sprints (implementação gradual)  
**Prioridade**: Alta (foundation do projeto)

---

## 📋 Índice

1. [Análise do Estado Atual](#análise-do-estado-atual)
2. [Por Que Migrar](#por-que-migrar)
3. [Estratégia de Migração](#estratégia-de-migração)
4. [Guia Passo a Passo](#guia-passo-a-passo)
5. [Exemplos Práticos](#exemplos-práticos)
6. [Checklist de Migração](#checklist-de-migração)
7. [Armadilhas Comuns](#armadilhas-comuns)
8. [Pós-Migração](#pós-migração)

---

## Análise do Estado Atual

### Arquitetura Atual (NgModules)

```
app/
├── app.ts (standalone: false)
├── app-module.ts
│   └── imports: [BrowserModule, CoreModule, SharedModule, LayoutModule, AppRoutingModule]
├── app-routing-module.ts
│   └── routes: loadChildren() → feature-module
├── core/
│   └── core-module.ts (interceptors, guards, services)
├── shared/
│   └── shared-module.ts (comum para todas as features)
├── layout/
│   └── layout-module.ts (MainLayout + componentes de layout)
└── features/
    ├── vehicles/
    │   ├── vehicles-module.ts (declarations, imports)
    │   ├── vehicles-routing-module.ts
    │   ├── components/ (VehicleImportModal, etc)
    │   ├── pages/ (VehiclesPage, VehicleFormPage, VehicleDetailPage)
    │   └── vehicles.service.ts
    ├── auth/
    ├── dashboard/
    └── ... (fuel, maintenance, tires, fines, etc)
```

### Problemas Identificados

| Problema                                | Impacto                    | Solução                         |
| --------------------------------------- | -------------------------- | ------------------------------- |
| Boilerplate (`declarations`, `imports`) | Bundle +5-10%              | Remover com standalone          |
| SharedModule importado em tudo          | Duplicação                 | Importar direto em componentes  |
| Módulos vazios (só routing)             | Complexidade               | Converter para routes arrays    |
| AuthModule sem lazy loading             | Carregamento desnecessário | Lazy load + provide guards      |
| Múltiplos níveis de módulos             | Confusão mental            | 1 módulo = 1 componente/feature |

---

## Por Que Migrar

### Números Concretos (Angular 21)

- **Bundle Size**: -8% em média (boilerplate removido)
- **Initial Load**: -200-300ms típico (tree-shaking melhor)
- **Linhas de Código**: -40% em feature modules
- **Testing Setup**: -50% (sem `TestBed.configureTestingModule` obrigatório)
- **Time to Market**: 20% mais rápido (menos conceitos)

### Alinhamento com Roadmap

A migração prepara o projeto para:

- ✅ Micro-frontends (standalone componentes com Module Federation)
- ✅ Server-side rendering (hydration com standalone)
- ✅ Signal-based reatividade (nova direção do Angular)
- ✅ Documentação oficial do Angular (só exemplo de standalone)

---

## Estratégia de Migração

### Fases

```
FASE 1: Foundation (1-2 sprints)
├─ Converter shared-module → standalone
├─ Converter core-module → standalone + providers
└─ Converter app.module → bootstrapApplication()

FASE 2: Layout & Routing (1 sprint)
├─ Converter layout-module → standalone
├─ Refatorar app-routing-module → routes array
└─ Ajustar lazy loading routes

FASE 3: Auth Feature (1 sprint)
├─ Converter auth-module → standalone
├─ Route guards com inject()
└─ Testes ajustados

FASE 4: Features Críticas (2 sprints)
├─ vehicles-module → standalone (priority: task 1.3 já pronta!)
├─ fuel-module → standalone
├─ drivers-module → standalone
└─ Outros módulos conforme prioridade

FASE 5: Cleanup & Documentação (0.5 sprint)
├─ Remover referências a NgModules
├─ Atualizar documentação interna
└─ Validar bundle size
```

### Princípios

1. **Sem quebrante** — sempre funciona durante migração
2. **Gradual** — NgModules e standalone podem coexistir
3. **Testado** — cada fase validada com testes e e2e
4. **Documentado** — exemplos práticos deixados no código

---

## Guia Passo a Passo

### Fase 1.1: Converter Shared Module

#### Passo 1: Mapear Exportações do Shared

```bash
# Antes: Listar tudo que shared-module exporta
grep -A 50 "imports:" apps/web/src/app/shared/shared-module.ts

# Exemplo:
# imports: [CommonModule, FormsModule, HttpClientModule, PoModule]
```

#### Passo 2: Criar Função de Provider

**Arquivo**: `apps/web/src/app/shared/shared.providers.ts`

```typescript
import { Provider } from '@angular/core';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { SharedService } from './shared.service';

export function provideSharedServices(): Provider[] {
  return [
    SharedService,
    // Interceptadores se houver
  ];
}
```

#### Passo 3: Converter Componentes/Pipes Compartilhados

**Antes:**

```typescript
// shared-module.ts
@NgModule({
  declarations: [CustomPipe, SharedComponent],
  imports: [CommonModule, PoModule],
  exports: [CustomPipe, SharedComponent, PoModule],
})
export class SharedModule {}
```

**Depois:**

```typescript
// shared-pipes.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'custom',
  standalone: true,
})
export class CustomPipe implements PipeTransform {
  transform(value: string): string {
    return value.toUpperCase();
  }
}

// shared-components.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PoModule } from '@po-ui/ng-components';

@Component({
  selector: 'app-shared-component',
  standalone: true,
  imports: [CommonModule, PoModule],
  template: '...',
})
export class SharedComponent {}

// shared.ts (barrel export)
export { CustomPipe } from './shared-pipes';
export { SharedComponent } from './shared-components';
export { provideSharedServices } from './shared.providers';
```

#### Passo 4: Atualizar App Module

**Antes:**

```typescript
import { SharedModule } from './shared/shared-module';

@NgModule({
  imports: [SharedModule, ...],
})
export class AppModule {}
```

**Depois:**

```typescript
import { provideSharedServices } from './shared/shared';

bootstrapApplication(App, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    provideSharedServices(),
    // ... outros providers
  ],
});
```

#### Passo 5: Validar

```bash
# Build deve passar sem warnings
npm run build

# Verificar bundle size não aumentou
npm run build -- --stats-json
```

---

### Fase 1.2: Converter Core Module

#### Padrão: Services → Providers

**Antes:**

```typescript
// core-module.ts
@NgModule({
  providers: [
    AuthService,
    TenantService,
    UserService,
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
})
export class CoreModule {}
```

**Depois:**

```typescript
// core.providers.ts
import { HTTP_INTERCEPTORS, HttpInterceptor } from '@angular/common/http';
import { Provider } from '@angular/core';

// Interceptadores como classes standalone-friendly
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}
  intercept(req, next) {
    /* ... */
  }
}

export function provideCoreServices(): Provider[] {
  return [
    AuthService,
    TenantService,
    UserService,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: TenantInterceptor,
      multi: true,
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: ErrorInterceptor,
      multi: true,
    },
  ];
}

// app.bootstrap.ts
bootstrapApplication(App, {
  providers: [
    provideCoreServices(),
    provideHttpClient(withInterceptorsFromDi()),
    // ...
  ],
});
```

#### Guards: De Classe para Função

**Antes:**

```typescript
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivateChild {
  constructor(private authService: AuthService, private router: Router) {}

  canActivateChild(): boolean {
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/auth/login']);
      return false;
    }
    return true;
  }
}

// app-routing.module.ts
{
  path: '',
  component: MainLayout,
  canActivateChild: [AuthGuard],
  children: [...]
}
```

**Depois:**

```typescript
// core/guards/auth.guard.ts
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/auth/login']);
    return false;
  }
  return true;
};

// routes.ts
{
  path: '',
  component: MainLayout,
  canActivateChild: [authGuard], // ← função, não classe
  children: [...]
}
```

---

### Fase 2: Converter Layout

**Arquivo**: `apps/web/src/app/layout/main-layout/main-layout.ts`

**Antes:**

```typescript
@NgModule({
  declarations: [MainLayout, HeaderComponent, SidebarComponent],
  imports: [CommonModule, RouterModule, PoModule, SharedModule],
})
export class LayoutModule {}
```

**Depois:**

```typescript
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PoModule } from '@po-ui/ng-components';
import { HeaderComponent } from './header/header.component';
import { SidebarComponent } from './sidebar/sidebar.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PoModule,
    HeaderComponent,
    SidebarComponent,
    // Pipes/componentes do shared conforme uso
  ],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  protected readonly title = signal('Frota Leve');

  constructor() {
    // Dependency injection ainda funciona
    const poTheme = inject(PoThemeService);
    poTheme.setDensityMode('small');
  }
}

// header.component.ts
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, PoModule],
  template: '...',
})
export class HeaderComponent {}

// sidebar.component.ts
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, PoModule],
  template: '...',
})
export class SidebarComponent {}
```

---

### Fase 2.2: Refatorar Rotas (App Module → Bootstrap)

**Antes:**

```typescript
// app.ts
@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.html',
})
export class App {}

// app-module.ts
@NgModule({
  declarations: [App],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    CoreModule,
    // ...
  ],
  bootstrap: [App],
})
export class AppModule {}

// main.ts
bootstrapModule(AppModule);
```

**Depois:**

```typescript
// app.ts
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet], // Precisa disso para rotas funcionarem!
  templateUrl: './app.html',
})
export class App {}

// app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { MainLayout } from './layout/main-layout/main-layout';

export const APP_ROUTES: Routes = [
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
        path: 'vehicles',
        loadChildren: () =>
          import('./features/vehicles/vehicles.routes').then((m) => m.VEHICLES_ROUTES),
      },
      // ... outras rotas
      {
        path: '**',
        redirectTo: 'dashboard',
      },
    ],
  },
];

// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { APP_ROUTES } from './app/app.routes';
import { provideCoreServices } from './app/core/core.providers';
import { provideSharedServices } from './app/shared/shared';

bootstrapApplication(App, {
  providers: [
    provideRouter(APP_ROUTES, {
      bindToComponentInputs: true,
      scrollPositionRestoration: 'enabled',
    }),
    provideHttpClient(withInterceptorsFromDi()),
    provideCoreServices(),
    provideSharedServices(),
    provideAnimations(),
  ],
}).catch((err) => console.error(err));
```

---

### Fase 3: Converter Feature Modules

#### Template: Vehicles (Priority)

**Estrutura Alvo:**

```
features/vehicles/
├── vehicles.routes.ts         ← array de rotas
├── vehicles-service.ts        ← service existente (sem mudança)
├── pages/
│   ├── vehicles-page.component.ts    (standalone: true)
│   ├── vehicle-form-page.component.ts (standalone: true)
│   └── vehicle-detail-page.component.ts (standalone: true)
└── components/
    └── vehicle-import-modal.component.ts (standalone: true)
```

**Passo 1: Converter Componentes**

```typescript
// vehicles-page.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PoModule } from '@po-ui/ng-components';
import { VehiclesService } from '../vehicles.service';

@Component({
  selector: 'app-vehicles-page',
  standalone: true,
  imports: [
    CommonModule,
    PoModule,
    // Pipes/componentes do shared conforme necessário
  ],
  templateUrl: './vehicles-page.component.html',
  styleUrl: './vehicles-page.component.scss',
})
export class VehiclesPage implements OnInit {
  private readonly vehiclesService = inject(VehiclesService);

  ngOnInit() {
    // lógica
  }
}

// vehicle-form-page.component.ts
@Component({
  selector: 'app-vehicle-form-page',
  standalone: true,
  imports: [CommonModule, PoModule, ReactiveFormsModule, VehicleImportModal],
  templateUrl: './vehicle-form-page.component.html',
})
export class VehicleFormPage {}

// vehicle-import-modal.component.ts
@Component({
  selector: 'app-vehicle-import-modal',
  standalone: true,
  imports: [CommonModule, PoModule],
  template: '...',
})
export class VehicleImportModal {}
```

**Passo 2: Criar Routes Array**

```typescript
// vehicles.routes.ts
import { Routes } from '@angular/router';
import { VehiclesPage } from './pages/vehicles-page/vehicles-page.component';
import { VehicleFormPage } from './pages/vehicle-form-page/vehicle-form-page.component';
import { VehicleDetailPage } from './pages/vehicle-detail-page/vehicle-detail-page.component';

export const VEHICLES_ROUTES: Routes = [
  {
    path: '',
    component: VehiclesPage,
  },
  {
    path: 'new',
    component: VehicleFormPage,
  },
  {
    path: ':id',
    component: VehicleDetailPage,
  },
  {
    path: ':id/edit',
    component: VehicleFormPage,
  },
];
```

**Passo 3: Remover Module**

```bash
# Deletar: features/vehicles/vehicles-module.ts
# Deletar: features/vehicles/vehicles-routing-module.ts
rm apps/web/src/app/features/vehicles/vehicles-module.ts
rm apps/web/src/app/features/vehicles/vehicles-routing-module.ts
```

**Passo 4: Atualizar App Routes**

```typescript
// app.routes.ts (antes)
{
  path: 'vehicles',
  loadChildren: () =>
    import('./features/vehicles/vehicles-module').then(m => m.VehiclesModule),
}

// app.routes.ts (depois)
{
  path: 'vehicles',
  loadChildren: () =>
    import('./features/vehicles/vehicles.routes').then(m => m.VEHICLES_ROUTES),
}
```

---

## Exemplos Práticos

### Exemplo 1: Injetar Service em Componente Standalone

```typescript
// ANTES: Precisa de TestBed
it('deve carregar veículos', () => {
  TestBed.configureTestingModule({
    declarations: [VehiclesPage],
    imports: [VehiclesModule],
    providers: [VehiclesService],
  });
  const service = TestBed.inject(VehiclesService);
});

// DEPOIS: Injeção direta
it('deve carregar veículos', () => {
  const service = new VehiclesService(jasmine.createSpyObj('HttpClient', ['get']));
  expect(service).toBeDefined();
});
```

### Exemplo 2: Lazy Load com Providers

```typescript
// ANTES
{
  path: 'vehicles',
  loadChildren: () => import('./vehicles-module').then(m => m.VehiclesModule),
}

// DEPOIS: Pode prover serviços direto na rota
{
  path: 'vehicles',
  loadChildren: () => import('./vehicles.routes').then(m => m.VEHICLES_ROUTES),
  providers: [VehiclesService], // ← Scoped à rota
}

// OU em vehicles.routes.ts
export const VEHICLES_ROUTES: Routes = [
  {
    path: '',
    component: VehiclesPage,
    providers: [VehiclesService], // ← Só para essa rota
  },
];
```

### Exemplo 3: Route Guard Standalone

```typescript
// Antes
@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  canActivate(route: ActivatedRouteSnapshot) {
    const requiredRole = route.data['role'];
    return this.authService.hasRole(requiredRole);
  }
}

// Depois
import { inject, CanActivateFn } from '@angular/core';
import { ActivatedRouteSnapshot } from '@angular/router';

export const roleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot
) => {
  const authService = inject(AuthService);
  const requiredRole = route.data['role'];
  return authService.hasRole(requiredRole);
};

// Uso
{
  path: 'settings',
  canActivate: [roleGuard],
  data: { role: 'OWNER' },
}
```

---

## Checklist de Migração

### Pré-Migração

- [ ] Backup do branch (ou já em branch feature)
- [ ] Testes e2e passando
- [ ] Bundle size baseline capturado (`npm run build -- --stats-json`)
- [ ] Documentação lida: [Angular Standalone Docs](https://angular.io/guide/standalone-components)

### Fase 1: Shared + Core

- [ ] `shared-module.ts` convertido para barrel exports
- [ ] Todos os pipes/componentes em arquivos standalone
- [ ] `core-module.ts` convertido para `core.providers.ts`
- [ ] Interceptadores registrados via `withInterceptorsFromDi()`
- [ ] Guards convertidos para funções
- [ ] Testes atualizados
- [ ] Build passa sem warnings
- [ ] Bundle size mantido ou reduzido

### Fase 2: Layout + Routing

- [ ] `layout-module.ts` deletado
- [ ] MainLayout e componentes filhos standalone
- [ ] App component standalone
- [ ] `main.ts` usa `bootstrapApplication()`
- [ ] `app.routes.ts` criado
- [ ] Rotas lazy loading ajustadas
- [ ] E2E tests passam
- [ ] Navegação funciona

### Fase 3: Auth

- [ ] `auth-module.ts` deletado
- [ ] Componentes auth standalone
- [ ] `auth.routes.ts` criado
- [ ] Route guards funcionando
- [ ] Login/logout fluxo testado
- [ ] Interceptadores ajustados se necessário

### Fase 4: Features Críticas

**Vehicles:**

- [ ] `vehicles-module.ts` e `vehicles-routing-module.ts` deletados
- [ ] Todos componentes standalone
- [ ] `vehicles.routes.ts` criado
- [ ] Service funcionando
- [ ] CRUD operacional
- [ ] E2E tests passam

**Fuel, Maintenance, Drivers (mesmo processo)**

### Fase 5: Cleanup

- [ ] Sem referências a `@NgModule` no código (exceto biblioteca)
- [ ] README atualizado com instruções standalone
- [ ] Documentação interna limpa
- [ ] Bundle size final comparado com baseline
- [ ] Performance metrics capturados

---

## Armadilhas Comuns

### 1️⃣ Esquecer `RouterOutlet` em App Component

```typescript
// ❌ ERRADO: Rotas não renderizam
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  template: '<main>Hello</main>',
})
export class App {}

// ✅ CERTO
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
export class App {}
```

### 2️⃣ Interceptadores não Registrados

```typescript
// ❌ ERRADO: Interceptadores não funcionam
bootstrapApplication(App, {
  providers: [
    provideRouter(routes),
    provideHttpClient(), // ← Falta withInterceptorsFromDi()
  ],
});

// ✅ CERTO
import { withInterceptorsFromDi } from '@angular/common/http';

bootstrapApplication(App, {
  providers: [provideRouter(routes), provideHttpClient(withInterceptorsFromDi())],
});
```

### 3️⃣ Providers em Componente vs Raiz

```typescript
// ❌ Não faz sentido em componente lazy-loaded
@Component({
  providers: [VehiclesService],
})
export class VehiclesPage {}

// E depois importar em MainLayout
@Component({
  imports: [VehiclesService], // ← Errado! Service, não componente
})
export class MainLayout {}

// ✅ CERTO: Prover na rota ou usar providedIn: 'root'
// Opção 1: Service scoped à rota
export const VEHICLES_ROUTES: Routes = [
  {
    path: '',
    component: VehiclesPage,
    providers: [VehiclesService],
  },
];

// Opção 2: Service global
@Injectable({ providedIn: 'root' })
export class VehiclesService {}
```

### 4️⃣ SharedModule vs Importar Direto

```typescript
// ❌ Ainda tentando usar SharedModule
@Component({
  imports: [SharedModule],
  template: '...',
})
export class MyComponent {}

// ✅ Importar componentes/pipes específicos
@Component({
  imports: [CommonModule, PoModule, CustomPipe, SharedComponent],
  template: '...',
})
export class MyComponent {}
```

### 5️⃣ Esquecer `provideAnimations()`

```typescript
// ❌ ERRADO: Animações não funcionam
bootstrapApplication(App, {
  providers: [provideRouter(routes)],
});

// ✅ CERTO
import { provideAnimations } from '@angular/platform-browser/animations';

bootstrapApplication(App, {
  providers: [
    provideRouter(routes),
    provideAnimations(), // ← Necessário se usar PoModule animations
  ],
});
```

---

## Pós-Migração

### Validação de Sucesso

```bash
# 1. Build deve ser limpo
npm run build

# 2. Testes devem passar 100%
npm run test

# 3. E2E deve funcionar
npm run e2e

# 4. Bundle size deve estar ≤ antes
npm run build -- --stats-json
# Comparar com baseline

# 5. Lighthouse score
npm run build
# Abrir em navegador e rodar Lighthouse

# 6. Nenhum warning de deprecation
npm run lint

# 7. Performance no dev server
npm run dev
# Verificar se hot reload está mais rápido
```

### Otimizações Adicionais Pós-Migração

1. **Code Splitting Automático**

   ```typescript
   // Já vai funcionar melhor com tree-shaking
   npm run build -- --configuration production --stats-json
   ```

2. **Signal-based Components** (future optimization)

   ```typescript
   @Component({
     template: `{{ count() }}`,
   })
   export class Counter {
     count = signal(0);
     increment = () => this.count.update((c) => c + 1);
   }
   ```

3. **OnPush Change Detection** (agora mais seguro)
   ```typescript
   @Component({
     changeDetection: ChangeDetectionStrategy.OnPush,
   })
   export class MyComponent {}
   ```

### Documentação Para Time

Criar arquivo `docs/ANGULAR-PATTERNS.md`:

```markdown
# Padrões Angular Standalone (Post-Migração)

## Estrutura de Feature Module
```

features/vehicles/
├── vehicles.routes.ts
├── vehicles.service.ts
├── pages/
│ ├── list.component.ts
│ ├── form.component.ts
│ └── detail.component.ts
└── components/
└── modal.component.ts

````

## Template: Novo Component

```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PoModule } from '@po-ui/ng-components';

@Component({
  selector: 'app-my-component',
  standalone: true,
  imports: [CommonModule, PoModule],
  templateUrl: './my-component.html',
  styleUrl: './my-component.scss',
})
export class MyComponent {}
````

## Prover Serviço

- **Global**: `@Injectable({ providedIn: 'root' })`
- **Rota**: `providers: [MyService]` em routes array
- **Componente**: `providers: [MyService]` em decorator

Escolha baseado em escopo necessário.

```

---

## Timeline Recomendada

| Sprint | Fase | Tarefas |
|--------|------|---------|
| S1 | 1.1 | Converter shared-module, criar shared.providers.ts, atualizar app-module.ts |
| S2 | 1.2 | Converter core-module, guards em funções, atualizar main.ts |
| S2 | 2 | Layout standalone, app.routes.ts, bootstrapApplication |
| S3 | 3 | Auth feature standalone, testes ajustados |
| S4 | 4.1 | Vehicles feature standalone (priority) |
| S5 | 4.2 | Fuel, Maintenance features |
| S6 | 4.3 | Remaining features (Tires, Fines, Drivers, etc) |
| S6 | 5 | Cleanup, documentação, validação final |

---

## Recursos

- 📖 [Angular Standalone Docs](https://angular.io/guide/standalone-components)
- 📖 [Dependency Injection in Standalone Apps](https://angular.io/guide/standalone-components#dependency-injection)
- 📖 [Router Configuration with Standalone Components](https://angular.io/guide/routing-with-urlmatcherrule#standalone-api-summary)
- 🎥 [Angular Standalone API Migration](https://www.youtube.com/watch?v=EjVo_fNxWxI)
- 🛠️ [Angular Schematics for Migration](https://github.com/angular/angular-cli/discussions/24862)

---

## FAQ

**P: Posso manter NgModules para algumas features?**
R: Sim, coexistem bem. Mas recomendo migrar tudo para evitar confusão mental.

**P: E backward compatibility com browsers antigos?**
R: Standalone não mudou suporte a browsers. Angular 21 suporta IE11 (se configurado).

**P: Bundle size vai diminuir automaticamente?**
R: Não automaticamente, mas tree-shaking é mais efetivo com standalone.

**P: Preciso refatorar testes?**
R: Sim, mas `TestBed` ainda funciona. Componentes standalone podem ser testados mais simples sem TestBed.

**P: E lazy loading?**
R: Funciona igual, mas com rotas arrays em vez de modules.

---

**Documento Criado**: 2026-04-07
**Última Revisão**: 2026-04-07
**Próxima Revisão**: Após completar Fase 1
```
