# 🔗 Mapa de Dependências - Frota Leve

**Documentação completa de módulos, serviços e relacionamentos**

---

## 📋 Índice

1. [Backend - Módulos NestJS](#-backend---módulos-nestjs)
2. [Frontend - Módulos Angular](#-frontend---módulos-angular)
3. [Database - Relacionamentos](#-database---relacionamentos)
4. [API Endpoints](#-api-endpoints)

---

## 🔷 Backend - Módulos NestJS

### Grafo de Dependências

```
┌─────────────────┐
│   AppModule     │ (Raiz)
└────────┬────────┘
         │
         ├─> ConfigModule (global)      [.env]
         ├─> PrismaModule (global)      [Database]
         │
         ├─> AuthModule ────────────┐
         │    ├─> JwtModule         │
         │    ├─> PassportModule    │
         │    └─> PrismaModule      │
         │                           │
         ├─> TenantsModule          │
         │    └─> PrismaModule      │
         │                           │
         ├─> UsersModule ───────────┤ (Dependem de Auth + Prisma)
         │    └─> PrismaModule      │
         │                           │
         ├─> VehiclesModule ────────┤
         │    └─> PrismaModule      │
         │                           │
         ├─> MaintenanceModule ─────┤
         │    └─> PrismaModule      │
         │                           │
         ├─> FuelModule ────────────┤
         │    └─> PrismaModule      │
         │                           │
         └─> ChecklistModule ───────┘
              └─> PrismaModule
```

---

### ConfigModule (Global)

**Arquivo:** `src/config/prisma.module.ts`, `src/config/prisma.service.ts`

**Responsabilidades:**
- Gerencia variáveis de ambiente (`.env`)
- Fornece `PrismaService` globalmente
- Conecta ao PostgreSQL

**Dependências:**
- `@nestjs/config`
- `@prisma/client`

**Exporta:**
- `PrismaService` (injetável em todos os módulos)

**Usado por:**
- Todos os módulos de feature (auth, users, vehicles, etc.)

---

### AuthModule

**Arquivo:** `src/auth/auth.module.ts`

**Responsabilidades:**
- Registro de novos tenants + admin user
- Login (email/password → JWT token)
- Estratégia JWT (Passport)

**Dependências:**
```typescript
imports: [
  PrismaModule,
  JwtModule.register({
    secret: process.env.JWT_SECRET,
    signOptions: { expiresIn: '7d' }
  }),
  PassportModule
]
```

**Controllers:**
- `AuthController`
  - `POST /auth/register` → Cria tenant + admin
  - `POST /auth/login` → Retorna JWT token

**Services:**
- `AuthService`
  - `register(dto)` → Cria tenant e admin user
  - `login(dto)` → Valida credenciais e gera token
  - `generateToken(user)` → Cria JWT payload

**Estratégias:**
- `JwtStrategy` → Valida token e extrai payload

**Exporta:**
- Nada (usado apenas internamente)

---

### TenantsModule

**Arquivo:** `src/tenants/tenants.module.ts`

**Responsabilidades:**
- CRUD de empresas (tenants)
- Gerenciamento de settings (configurações da empresa)

**Dependências:**
```typescript
imports: [PrismaModule]
```

**Controllers:**
- `TenantsController`
  - `GET /tenants` → Lista tenants
  - `GET /tenants/:id` → Detalhes do tenant
  - `PATCH /tenants/:id` → Atualiza tenant
  - `GET /tenants/:id/settings` → Configurações

**Services:**
- `TenantsService`
  - `findAll(tenantId)` → Lista (filtrado por tenantId)
  - `findOne(tenantId, id)` → Detalhes
  - `update(tenantId, id, dto)` → Atualiza

**Exporta:**
- `TenantsService` (caso outros módulos precisem)

---

### UsersModule

**Arquivo:** `src/users/users.module.ts`

**Responsabilidades:**
- CRUD de usuários
- Gerenciamento de roles (ADMIN_EMPRESA, GESTOR_FROTA, MOTORISTA)

**Dependências:**
```typescript
imports: [PrismaModule]
```

**Controllers:**
- `UsersController`
  - `POST /users` → Criar usuário
  - `GET /users` → Listar usuários
  - `GET /users/:id` → Detalhes
  - `PATCH /users/:id` → Atualizar
  - `DELETE /users/:id` → Deletar (soft delete futuro)

**Services:**
- `UsersService`
  - `create(tenantId, dto)` → Cria usuário (bcrypt password)
  - `findAll(tenantId)` → Lista usuários do tenant
  - `findOne(tenantId, id)` → Detalhes
  - `update(tenantId, id, dto)` → Atualiza
  - `remove(tenantId, id)` → Deleta

**Exporta:**
- `UsersService` (usado por AuthModule)

---

### VehiclesModule

**Arquivo:** `src/vehicles/vehicles.module.ts`

**Responsabilidades:**
- CRUD de veículos
- Estatísticas (total, ativos, em manutenção)
- Atualização de odômetro

**Dependências:**
```typescript
imports: [PrismaModule]
```

**Controllers:**
- `VehiclesController`
  - `POST /vehicles` → Criar veículo
  - `GET /vehicles` → Listar (com filtros: status, search)
  - `GET /vehicles/stats` → Estatísticas
  - `GET /vehicles/:id` → Detalhes (com maintenances e fuelLogs)
  - `PATCH /vehicles/:id` → Atualizar
  - `PATCH /vehicles/:id/odometer` → Atualizar odômetro
  - `DELETE /vehicles/:id` → Deletar

**Services:**
- `VehiclesService`
  - `create(tenantId, dto)` → Valida placa única
  - `findAll(tenantId, filters)` → Busca com OR (name/plate)
  - `findOne(tenantId, id)` → Include relacionamentos
  - `getStats(tenantId)` → Contadores por status
  - `updateOdometer(tenantId, id, odometer)` → Atualiza km

**Exporta:**
- `VehiclesService` (usado por MaintenanceModule, FuelModule)

---

### MaintenanceModule

**Arquivo:** `src/maintenance/maintenance.module.ts`

**Responsabilidades:**
- CRUD de manutenções
- Planos de manutenção (templates)
- Manutenções próximas (upcoming)

**Dependências:**
```typescript
imports: [PrismaModule]
```

**Controllers:**
- `MaintenanceController`
  - `POST /maintenance` → Criar manutenção
  - `GET /maintenance` → Listar (filtros: vehicleId, startDate, endDate)
  - `GET /maintenance/upcoming` → Manutenções próximas
  - `GET /maintenance/:id` → Detalhes
  - `PATCH /maintenance/:id` → Atualizar
  - `DELETE /maintenance/:id` → Deletar
  - **Plans:**
    - `POST /maintenance/plans` → Criar plano
    - `GET /maintenance/plans` → Listar planos
    - `PATCH /maintenance/plans/:id` → Atualizar plano

**Services:**
- `MaintenanceService`
  - `create(tenantId, dto)` → Valida vehicleId
  - `findAll(tenantId, filters)` → Filtra por data/veículo
  - `getUpcoming(tenantId)` → Manutenções futuras
  - **Plans:**
    - `createPlan(tenantId, dto)`
    - `findAllPlans(tenantId)`

**Exporta:**
- `MaintenanceService`

---

### FuelModule

**Arquivo:** `src/fuel/fuel.module.ts`

**Responsabilidades:**
- CRUD de abastecimentos
- Analytics (consumo médio, custo por km)

**Dependências:**
```typescript
imports: [PrismaModule]
```

**Controllers:**
- `FuelController`
  - `POST /fuel` → Criar abastecimento
  - `GET /fuel` → Listar (filtros: vehicleId, startDate, endDate)
  - `GET /fuel/analytics` → Métricas (km/l, R$/km)
  - `GET /fuel/:id` → Detalhes
  - `PATCH /fuel/:id` → Atualizar
  - `DELETE /fuel/:id` → Deletar

**Services:**
- `FuelService`
  - `create(tenantId, dto)` → Valida vehicleId e driverId
  - `findAll(tenantId, filters)` → Filtra por data/veículo
  - `getAnalytics(tenantId, filters)` → Calcula km/l e custo

**Exporta:**
- `FuelService`

---

### ChecklistModule

**Arquivo:** `src/checklist/checklist.module.ts`

**Responsabilidades:**
- Templates de checklists (itens padrão)
- Submissões de checklists (respostas dos motoristas)

**Dependências:**
```typescript
imports: [PrismaModule]
```

**Controllers:**
- `ChecklistController`
  - **Templates:**
    - `POST /checklist/templates` → Criar template
    - `GET /checklist/templates` → Listar templates
    - `GET /checklist/templates/:id` → Detalhes (com items)
    - `PATCH /checklist/templates/:id` → Atualizar
  - **Submissions:**
    - `POST /checklist/submissions` → Criar submissão
    - `GET /checklist/submissions` → Listar submissões
    - `GET /checklist/submissions/:id` → Detalhes (com answers)

**Services:**
- `ChecklistService`
  - **Templates:**
    - `createTemplate(tenantId, dto)` → Cria template + items
    - `findAllTemplates(tenantId)`
  - **Submissions:**
    - `createSubmission(tenantId, dto)` → Cria submission + answers
    - `findAllSubmissions(tenantId, filters)` → Filtra por veículo/status

**Exporta:**
- `ChecklistService`

---

## 🔶 Frontend - Módulos Angular

### Grafo de Dependências

```
┌─────────────────┐
│   AppConfig     │ (Bootstrap)
└────────┬────────┘
         │
         ├─> HttpClient (provideHttpClient)
         ├─> Router (provideRouter)
         └─> Interceptors
              ├─> AuthInterceptor   [Adiciona JWT header]
              └─> ErrorInterceptor  [Trata erros HTTP]

┌─────────────────────────────────────────────────────────┐
│                    Core Module                          │
│  (Serviços singleton, guards, interceptors)             │
├─────────────────────────────────────────────────────────┤
│  Guards:                                                │
│    └─> authGuard           [Protege rotas privadas]    │
│                                                         │
│  Interceptors:                                          │
│    ├─> AuthInterceptor     [Adiciona Bearer token]     │
│    └─> ErrorInterceptor    [Trata 401/403/500]         │
│                                                         │
│  Services:                                              │
│    ├─> ApiService          [HTTP genérico]             │
│    ├─> AuthService         [Login/Logout]              │
│    └─> ThemeService        [Dark/Light mode]           │
│                                                         │
│  Models:                                                │
│    ├─> user.model.ts                                   │
│    └─> vehicle.model.ts                                │
└─────────────────────────────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Features   │  │  Features   │  │  Shared     │
│    Auth     │  │  Dashboard  │  │ Components  │
└─────────────┘  └─────────────┘  └─────────────┘
     │                │                │
     │                ├─> Vehicles     ├─> Navbar
     │                ├─> Maintenance  ├─> Sidebar
     │                ├─> Fuel         ├─> Button
     │                └─> Checklist    ├─> Card
     │                                 └─> StatCard
     │
     └─> Login, Register
```

---

### Core Module (Serviços Singleton)

**Localização:** `src/app/core/`

#### Guards

**authGuard** (`guards/auth-guard.ts`):
- Verifica se há token no `localStorage`
- Redireciona para `/auth/login` se não autenticado
- Usado em todas as rotas protegidas

```typescript
export const authGuard: CanActivateFn = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    inject(Router).navigate(['/auth/login']);
    return false;
  }
  return true;
};
```

#### Interceptors

**AuthInterceptor** (`interceptors/auth-interceptor.ts`):
- Adiciona header `Authorization: Bearer <token>` em todas as requisições
- Usado automaticamente pelo HttpClient

**ErrorInterceptor** (`interceptors/error-interceptor.ts`):
- Intercepta erros HTTP (401, 403, 500)
- 401 → Redireciona para login
- Exibe mensagens de erro

#### Services

**ApiService** (`services/api.ts`):
- Wrapper do HttpClient
- Métodos: `get()`, `post()`, `patch()`, `put()`, `delete()`
- Constrói query params automaticamente
- Retorna `Promise<T>` (async/await)

**Dependências:**
```typescript
private http = inject(HttpClient);
private baseUrl = environment.apiUrl;  // http://localhost:3000
```

**Usado por:**
- Todos os feature services (VehicleService, FuelService, etc.)

---

**AuthService** (`services/auth.ts`):
- Login/Logout
- Gerencia token no `localStorage`
- Signals: `currentUser()`, `isAuthenticated()`

**Métodos:**
```typescript
login(email, password) → { access_token, user }
register(data) → { access_token, user }
logout() → void (limpa localStorage)
```

**Dependências:**
- `ApiService`

**Usado por:**
- `LoginComponent`
- `RegisterComponent`
- `authGuard`

---

**ThemeService** (`services/theme.ts`):
- Dark/Light mode toggle
- Persiste preferência no `localStorage`

**Métodos:**
```typescript
toggleTheme() → void
setTheme('light' | 'dark') → void
currentTheme = signal<'light' | 'dark'>('light')
```

**Usado por:**
- `ThemeToggleComponent`

---

### Feature Modules

#### AuthModule

**Rotas:** `/auth/login`, `/auth/register`

**Componentes:**
- `LoginComponent` → Formulário de login
- `RegisterComponent` → Formulário de registro

**Serviços:**
- `AuthService` (do Core)

**Dependências:**
- `ReactiveFormsModule` (formulários)
- `RouterLink` (navegação)

---

#### DashboardModule

**Rotas:** `/dashboard` (parent com sidebar/navbar)

**Componentes:**
- `DashboardLayoutComponent` → Layout com `<router-outlet>`
- `OverviewComponent` → Página inicial com cards de stats

**Serviços:**
- `VehicleService` → Para stats de veículos
- `MaintenanceService` → Para manutenções próximas

---

#### VehiclesModule

**Rotas:** `/vehicles`, `/vehicles/new`, `/vehicles/:id`

**Componentes:**
- `VehicleListComponent` → Tabela de veículos
- `VehicleFormComponent` → Formulário de criação/edição
- `VehicleDetailComponent` → Detalhes + manutenções + abastecimentos

**Serviços:**
- `VehicleService` → CRUD de veículos

**Dependências:**
- `ApiService` (do Core)

---

#### MaintenanceModule

**Rotas:** `/maintenance`, `/maintenance/new`, `/maintenance/plans`

**Componentes:**
- `MaintenanceListComponent` → Tabela de manutenções
- `MaintenanceFormComponent` → Formulário
- `TemplateListComponent` → Planos de manutenção

**Serviços:**
- `MaintenanceService` → CRUD + plans

---

#### FuelModule

**Rotas:** `/fuel`, `/fuel/new`, `/fuel/analytics`

**Componentes:**
- `FuelListComponent` → Tabela de abastecimentos
- `FuelFormComponent` → Formulário
- `FuelAnalyticsComponent` → Gráficos (km/l, custo)

**Serviços:**
- `FuelService` → CRUD + analytics

---

#### ChecklistModule

**Rotas:** `/checklist/templates`, `/checklist/submissions`

**Componentes:**
- `TemplateListComponent` → Templates de checklist
- `TemplateFormComponent` → Criar template
- `SubmissionListComponent` → Respostas de checklists
- `SubmissionFormComponent` → Responder checklist

**Serviços:**
- `ChecklistService` → Templates + submissions

---

### Shared Components

**Localização:** `src/app/shared/components/`

**Componentes reutilizáveis:**
- `NavbarComponent` → Barra superior (logo, user menu, theme toggle)
- `SidebarComponent` → Menu lateral (links de navegação)
- `ButtonComponent` → Botão customizado (6 variantes)
- `CardComponent` → Card com header/content/footer
- `StatCardComponent` → Card de estatísticas (ícone + valor)
- `ThemeToggleComponent` → Toggle dark/light

**Sem dependências externas** (standalone)

---

## 🔹 Database - Relacionamentos

### Grafo de Entidades

```
┌────────────┐
│   Tenant   │ (Empresa)
└──────┬─────┘
       │
       ├─> Users (1:N)
       │    └─> role: ADMIN_EMPRESA | GESTOR_FROTA | MOTORISTA
       │
       ├─> Vehicles (1:N)
       │    ├─> Maintenances (1:N)
       │    ├─> FuelLogs (1:N)
       │    │    └─> driver: User (N:1)
       │    ├─> ChecklistSubmissions (1:N)
       │    │    ├─> driver: User (N:1)
       │    │    ├─> template: ChecklistTemplate (N:1)
       │    │    └─> answers: ChecklistAnswer[] (1:N)
       │    │         └─> item: ChecklistTemplateItem (N:1)
       │    └─> Reminders (1:N)
       │
       ├─> MaintenancePlans (1:N)
       │    └─> maintenances: Maintenance[] (1:N - opcional)
       │
       ├─> ChecklistTemplates (1:N)
       │    └─> items: ChecklistTemplateItem[] (1:N)
       │
       └─> TenantSettings (1:1)
```

---

### Relacionamentos Detalhados

#### Tenant (Raiz)

**Relaciona com:**
- `User[]` → Usuários da empresa (onDelete: Cascade)
- `Vehicle[]` → Veículos da empresa (onDelete: Cascade)
- `MaintenancePlan[]` → Planos de manutenção (onDelete: Cascade)
- `ChecklistTemplate[]` → Templates de checklist (onDelete: Cascade)
- `TenantSettings` → Configurações (onDelete: Cascade)

**Isolamento:**
- Todos os models filhos possuem `tenantId`
- Cascata de deleção garante remoção completa

---

#### Vehicle

**Relaciona com:**
- `Tenant` → Pertence a uma empresa (N:1)
- `Maintenance[]` → Manutenções do veículo (1:N, onDelete: Cascade)
- `FuelLog[]` → Abastecimentos (1:N, onDelete: Cascade)
- `ChecklistSubmission[]` → Checklists (1:N, onDelete: Cascade)
- `Reminder[]` → Lembretes (1:N, onDelete: Cascade)

**Soft Delete (Futuro):**
- Atualmente: `DELETE` remove fisicamente
- Futuro: `status = SOLD/INACTIVE` + `deletedAt`

---

#### Maintenance

**Relaciona com:**
- `Tenant` → Empresa (N:1)
- `Vehicle` → Veículo (N:1)
- `MaintenancePlan` → Plano de manutenção opcional (N:1, onDelete: SetNull)

**Índices:**
- `[tenantId]` → Performance multi-tenant
- `[vehicleId]` → Busca por veículo
- `[date]` → Ordenação por data

---

#### FuelLog

**Relaciona com:**
- `Tenant` → Empresa (N:1)
- `Vehicle` → Veículo (N:1)
- `User (driver)` → Motorista que abasteceu (N:1)

**Cálculos:**
- `liters / (odometer - odometer_anterior)` → km/l
- `totalValue / liters` → R$/litro

---

#### ChecklistTemplate + ChecklistSubmission

**Template:**
- `ChecklistTemplate` → Modelo de checklist
- `ChecklistTemplateItem[]` → Itens do template
- `isActive` → Permite desativar templates

**Submission:**
- `ChecklistSubmission` → Resposta do checklist
- `ChecklistAnswer[]` → Respostas individuais
- `overallStatus` → OK | ALERT | CRITICAL (calculado)

**Relação:**
- 1 Template pode ter N Submissions
- 1 Submission responde 1 Template
- Answers conectam Submission Items ↔ Template Items

---

## 🔸 API Endpoints

### Tabela Resumida

| Módulo       | Endpoint Base       | Métodos Principais                          |
|--------------|---------------------|---------------------------------------------|
| Auth         | `/auth`             | POST /register, POST /login                 |
| Tenants      | `/tenants`          | GET /, GET /:id, PATCH /:id                 |
| Users        | `/users`            | POST /, GET /, GET /:id, PATCH /:id, DELETE |
| Vehicles     | `/vehicles`         | POST /, GET /, GET /stats, GET /:id, PATCH  |
| Maintenance  | `/maintenance`      | POST /, GET /, GET /upcoming, PATCH         |
| Fuel         | `/fuel`             | POST /, GET /, GET /analytics, PATCH        |
| Checklist    | `/checklist`        | Templates + Submissions (POST/GET)          |

### Documentação Completa

**Swagger:** `http://localhost:3000/api`

---

## 📊 Fluxo de Dados Completo

### Exemplo: Criar Abastecimento

```
1. Frontend (Angular)
   └─> FuelFormComponent.onSubmit()
        └─> FuelService.create(data)
             └─> ApiService.post('/fuel', data)
                  └─> HttpClient.post() + AuthInterceptor
                       └─> Header: "Authorization: Bearer <token>"

2. Backend (NestJS)
   └─> FuelController.create(@TenantId() tenantId, @Body() dto)
        └─> AuthGuard('jwt') valida token
        └─> JwtStrategy extrai payload { sub, email, role, tenantId }
        └─> @TenantId() decorator extrai tenantId
        └─> FuelService.create(tenantId, dto)
             └─> Valida vehicleId (existe no tenant?)
             └─> Valida driverId (existe no tenant?)
             └─> Prisma.fuelLog.create({ data: { ...dto, tenantId } })

3. Database (PostgreSQL)
   └─> INSERT INTO fuel_log (id, tenant_id, vehicle_id, driver_id, ...)

4. Response
   └─> Backend retorna objeto FuelLog criado
        └─> Frontend recebe e atualiza lista
             └─> Router navega para /fuel
```

---

**Desenvolvido por PalsCorp © 2025**
