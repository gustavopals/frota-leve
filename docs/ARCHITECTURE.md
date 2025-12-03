# 🏗️ Arquitetura do Sistema - Frota Leve

**Versão:** 1.0.0  
**Data:** 03/12/2025  
**Stack:** NestJS + Prisma + Angular 18 + PostgreSQL

---

## 📋 Visão Geral

O **Frota Leve** é um sistema SaaS multi-tenant para gestão de frotas leves (caminhonetes, vans, pickups e maquinário pequeno). A arquitetura segue os princípios de **Clean Architecture**, **SOLID** e **DDD (Domain-Driven Design)**.

### Características Principais

- ✅ **Multi-tenancy por linha** (row-level isolation)
- ✅ **Autenticação JWT** com refresh token capability
- ✅ **API RESTful** documentada com Swagger
- ✅ **Frontend SPA** com Angular 18
- ✅ **Mobile-ready** via Capacitor (Android/iOS)
- ✅ **Real-time capable** (preparado para WebSockets)
- ✅ **Escalável horizontalmente**

---

## 🎯 Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────────────┐
│                      CAMADA DE APRESENTAÇÃO                  │
│  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ │
│  │  Web Browser   │  │  Mobile App    │  │   API Docs    │ │
│  │  (Angular 18)  │  │  (Capacitor)   │  │   (Swagger)   │ │
│  └────────────────┘  └────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         GATEWAY LAYER                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              NGINX / Load Balancer (Futuro)            │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      CAMADA DE APLICAÇÃO                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    NestJS Backend                       │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │ │
│  │  │   Auth   │ │ Vehicles │ │   Fuel   │ │Checklist │  │ │
│  │  │  Module  │ │  Module  │ │  Module  │ │  Module  │  │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐               │ │
│  │  │  Users   │ │Maintenan.│ │ Tenants  │               │ │
│  │  │  Module  │ │  Module  │ │  Module  │               │ │
│  │  └──────────┘ └──────────┘ └──────────┘               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      CAMADA DE DOMÍNIO                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    Prisma ORM                           │ │
│  │  ┌────────────────────────────────────────────────┐    │ │
│  │  │  Models: Tenant, User, Vehicle, Maintenance,  │    │ │
│  │  │  FuelLog, ChecklistTemplate, Reminder          │    │ │
│  │  └────────────────────────────────────────────────┘    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CAMADA DE PERSISTÊNCIA                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              PostgreSQL 14+ Database                    │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │ │
│  │  │ tenants  │ │  users   │ │ vehicles │ │fuel_logs │  │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Estrutura de Diretórios

### Backend (NestJS)

```
backend/
├── prisma/
│   ├── schema.prisma              # Schema do banco de dados
│   ├── migrations/                # Histórico de migrations
│   │   └── YYYYMMDDHHMMSS_name/
│   │       └── migration.sql
│   └── seed.ts                    # Dados iniciais para desenvolvimento
│
├── src/
│   ├── main.ts                    # Entry point da aplicação
│   ├── app.module.ts              # Módulo raiz (importa todos os módulos)
│   │
│   ├── config/                    # Configurações globais
│   │   ├── prisma.service.ts      # Serviço Prisma (singleton)
│   │   └── prisma.module.ts       # Módulo Prisma (global)
│   │
│   ├── common/                    # Recursos compartilhados
│   │   ├── decorators/            # Decorators customizados
│   │   │   ├── tenant-id.decorator.ts      # Extrai tenantId do JWT
│   │   │   ├── current-user.decorator.ts   # Extrai user completo
│   │   │   ├── roles.decorator.ts          # Define roles necessárias
│   │   │   └── index.ts                    # Barrel export
│   │   │
│   │   ├── guards/                # Guards de autorização
│   │   │   └── roles.guard.ts     # Verifica roles do usuário
│   │   │
│   │   ├── interceptors/          # Interceptors HTTP (futuro)
│   │   ├── filters/               # Exception filters (futuro)
│   │   └── dto/                   # DTOs genéricos
│   │       └── pagination.dto.ts  # DTO de paginação
│   │
│   ├── auth/                      # Módulo de Autenticação
│   │   ├── auth.module.ts         # Configuração JWT + Passport
│   │   ├── auth.service.ts        # Lógica de login/register
│   │   ├── auth.controller.ts     # Endpoints /auth/*
│   │   ├── jwt.strategy.ts        # Estratégia JWT Passport
│   │   └── dto/
│   │       ├── login.dto.ts       # DTO de login
│   │       └── register.dto.ts    # DTO de registro
│   │
│   ├── tenants/                   # Módulo de Empresas
│   │   ├── tenants.module.ts
│   │   ├── tenants.service.ts     # CRUD de tenants + settings
│   │   └── tenants.controller.ts  # Endpoints /tenants/*
│   │
│   ├── users/                     # Módulo de Usuários
│   │   ├── users.module.ts
│   │   ├── users.service.ts       # CRUD de usuários (multi-tenant)
│   │   ├── users.controller.ts    # Endpoints /users/*
│   │   └── dto/
│   │       ├── create-user.dto.ts
│   │       └── update-user.dto.ts
│   │
│   ├── vehicles/                  # Módulo de Veículos
│   │   ├── vehicles.module.ts
│   │   ├── vehicles.service.ts    # CRUD + stats + odometer
│   │   ├── vehicles.controller.ts # Endpoints /vehicles/*
│   │   └── dto/
│   │       ├── create-vehicle.dto.ts
│   │       ├── update-vehicle.dto.ts
│   │       └── update-odometer.dto.ts
│   │
│   ├── maintenance/               # Módulo de Manutenções
│   │   ├── maintenance.module.ts
│   │   ├── maintenance.service.ts # CRUD + plans + upcoming
│   │   ├── maintenance.controller.ts
│   │   └── dto/
│   │       ├── create-maintenance.dto.ts
│   │       ├── update-maintenance.dto.ts
│   │       ├── create-maintenance-plan.dto.ts
│   │       └── update-maintenance-plan.dto.ts
│   │
│   ├── fuel/                      # Módulo de Abastecimentos
│   │   ├── fuel.module.ts
│   │   ├── fuel.service.ts        # CRUD + analytics + stats
│   │   ├── fuel.controller.ts
│   │   └── dto/
│   │       ├── create-fuel-log.dto.ts
│   │       └── update-fuel-log.dto.ts
│   │
│   └── checklist/                 # Módulo de Checklists
│       ├── checklist.module.ts
│       ├── checklist.service.ts   # Templates + Submissions
│       ├── checklist.controller.ts
│       └── dto/
│           ├── create-template.dto.ts
│           ├── update-template.dto.ts
│           └── create-submission.dto.ts
│
├── test/                          # Testes E2E
└── docker/                        # Arquivos Docker
    ├── init.sql                   # Script inicial do PostgreSQL
    └── servers.json               # Configuração pgAdmin
```

### Frontend (Angular 18)

```
frontend/
├── src/
│   ├── main.ts                    # Bootstrap da aplicação
│   ├── index.html                 # HTML principal
│   ├── styles.scss                # Estilos globais + Tailwind
│   │
│   ├── environments/              # Variáveis de ambiente
│   │   ├── environment.ts         # Produção
│   │   └── environment.development.ts # Desenvolvimento
│   │
│   ├── app/
│   │   ├── app.ts                 # Componente raiz
│   │   ├── app.routes.ts          # Configuração de rotas
│   │   ├── app.config.ts          # Providers globais
│   │   │
│   │   ├── core/                  # Serviços e guards essenciais
│   │   │   ├── guards/
│   │   │   │   └── auth-guard.ts  # Proteção de rotas privadas
│   │   │   │
│   │   │   ├── interceptors/
│   │   │   │   ├── auth-interceptor.ts    # Adiciona JWT token
│   │   │   │   └── error-interceptor.ts   # Trata erros HTTP
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── api.ts         # HTTP client genérico
│   │   │   │   ├── auth.ts        # Autenticação (login/register/logout)
│   │   │   │   └── theme.ts       # Dark/Light mode
│   │   │   │
│   │   │   └── models/
│   │   │       ├── user.model.ts  # Interfaces de User
│   │   │       └── vehicle.model.ts # Interfaces de Vehicle
│   │   │
│   │   ├── shared/                # Componentes reutilizáveis
│   │   │   └── components/
│   │   │       ├── navbar/        # Barra de navegação superior
│   │   │       ├── sidebar/       # Menu lateral
│   │   │       ├── button/        # Botão customizado (6 variantes)
│   │   │       ├── card/          # Card + subcomponentes
│   │   │       ├── stat-card/     # Card de estatísticas
│   │   │       └── theme-toggle/  # Toggle de tema
│   │   │
│   │   └── features/              # Módulos de funcionalidade
│   │       │
│   │       ├── auth/              # Autenticação
│   │       │   ├── auth.routes.ts
│   │       │   └── pages/
│   │       │       ├── login/
│   │       │       │   ├── login.ts
│   │       │       │   └── login.html
│   │       │       └── register/
│   │       │
│   │       ├── dashboard/         # Dashboard
│   │       │   ├── dashboard.routes.ts
│   │       │   ├── dashboard-layout/  # Layout com navbar/sidebar
│   │       │   └── pages/
│   │       │       └── overview/  # Página inicial
│   │       │
│   │       ├── vehicles/          # Veículos
│   │       │   ├── vehicles.routes.ts
│   │       │   └── pages/
│   │       │       ├── vehicle-list/
│   │       │       └── vehicle-form/
│   │       │
│   │       ├── maintenance/       # Manutenções
│   │       │   ├── maintenance.routes.ts
│   │       │   └── pages/
│   │       │       ├── maintenance-list/
│   │       │       ├── maintenance-form/
│   │       │       └── template-list/
│   │       │
│   │       ├── fuel/              # Abastecimentos
│   │       │   ├── fuel.routes.ts
│   │       │   └── pages/
│   │       │       ├── fuel-list/
│   │       │       ├── fuel-form/
│   │       │       └── fuel-analytics/
│   │       │
│   │       └── checklist/         # Checklists
│   │           ├── checklist.routes.ts
│   │           └── pages/
│   │               ├── template-list/
│   │               ├── template-form/
│   │               ├── submission-list/
│   │               └── submission-form/
│   │
│   └── public/                    # Assets estáticos
│       ├── favicon.svg
│       └── favicon.ico
│
├── android/                       # Build Capacitor Android
└── capacitor.config.ts            # Configuração mobile
```

---

## 🔄 Fluxo de Dados

### 1. Autenticação (Login)

```
┌──────────┐   POST /auth/login    ┌─────────────┐
│  Client  │ ─────────────────────>│   Backend   │
│ (Angular)│                        │  (NestJS)   │
└──────────┘                        └─────────────┘
     │                                     │
     │                              1. Busca user por email
     │                              2. Valida password (bcrypt)
     │                              3. Verifica tenant.isActive
     │                              4. Gera JWT token
     │                                     │
     │   { access_token, user }            │
     │ <─────────────────────────────────────
     │
     │  Armazena token no localStorage
     │  Redireciona para /dashboard
     ▼
```

### 2. Requisição Autenticada (CRUD)

```
┌──────────┐  GET /vehicles        ┌─────────────┐
│  Client  │ ─────────────────────>│   Backend   │
│          │  Authorization:        │             │
│          │  Bearer <token>        │             │
└──────────┘                        └─────────────┘
                                          │
                                    1. AuthGuard valida JWT
                                    2. JwtStrategy extrai payload
                                    3. @TenantId() decorator extrai tenantId
                                    4. Service filtra por tenantId
                                          │
     { data: [...vehicles] }               │
     <────────────────────────────────────────
```

### 3. Multi-tenant Isolation

```
JWT Payload:
{
  sub: "user-uuid",           → ID do usuário
  email: "admin@empresa.com",
  role: "ADMIN_EMPRESA",      → Role do usuário
  tenantId: "tenant-uuid",    → ID da empresa (ISOLAMENTO)
  iat: 1234567890,
  exp: 1234999999
}

Controller:
@Get()
findAll(@TenantId() tenantId: string) {
  // tenantId = "tenant-uuid" (extraído do JWT)
  return this.service.findAll(tenantId);
}

Service:
async findAll(tenantId: string) {
  return this.prisma.vehicle.findMany({
    where: { tenantId }  // ✅ ISOLAMENTO AUTOMÁTICO
  });
}
```

---

## 🔐 Segurança

### 1. Multi-tenancy (Row-Level Security)

**Estratégia:** Cada tabela possui coluna `tenantId`

```prisma
model Vehicle {
  id       String @id @default(uuid())
  tenantId String  // ← Chave de isolamento
  plate    String
  
  tenant Tenant @relation(fields: [tenantId], references: [id])
  
  @@index([tenantId])  // ← Performance em queries filtradas
}
```

**Proteções:**
- ✅ `@TenantId()` decorator obrigatório em todos os controllers
- ✅ Services SEMPRE filtram por `tenantId`
- ✅ JWT contém `tenantId` imutável
- ✅ Cascata de deleção: `onDelete: Cascade`

### 2. Autenticação JWT

```typescript
// Token gerado no login
const payload = {
  sub: user.id,          // Subject (user ID)
  email: user.email,
  role: user.role,       // ADMIN_EMPRESA | GESTOR_FROTA | MOTORISTA
  tenantId: user.tenantId
};

const token = this.jwtService.sign(payload, {
  expiresIn: '7d'  // ⚠️ TODO: Reduzir para 15m + refresh token
});
```

### 3. Autorização (RBAC)

```typescript
@Roles(UserRole.ADMIN_EMPRESA, UserRole.GESTOR_FROTA)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Delete(':id')
deleteUser(@TenantId() tenantId: string, @Param('id') id: string) {
  // Apenas ADMIN_EMPRESA ou GESTOR_FROTA podem deletar usuários
}
```

### 4. Validação de Dados

```typescript
export class CreateVehicleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/, {
    message: 'Placa inválida (formato: ABC1D23)'
  })
  plate: string;
}
```

---

## 📊 Modelos de Dados (Domínio)

### Entidades Principais

```
Tenant (Empresa)
  ├── Users (Usuários)
  ├── Vehicles (Veículos)
  │     ├── Maintenances (Manutenções)
  │     ├── FuelLogs (Abastecimentos)
  │     ├── ChecklistSubmissions (Checklists Respondidos)
  │     └── Reminders (Lembretes)
  ├── MaintenancePlans (Planos de Manutenção)
  ├── ChecklistTemplates (Templates de Checklist)
  └── TenantSettings (Configurações)
```

### Relacionamentos

```prisma
// 1:N - Um Tenant tem muitos Users
Tenant 1 ──< N User

// 1:N - Um Tenant tem muitos Vehicles
Tenant 1 ──< N Vehicle

// 1:N - Um Vehicle tem muitos FuelLogs
Vehicle 1 ──< N FuelLog

// N:1 - Um FuelLog pertence a um User (motorista)
FuelLog N >── 1 User (driver)

// N:1 - Uma Maintenance pode seguir um MaintenancePlan
Maintenance N >── 1 MaintenancePlan (opcional)

// 1:N - Um ChecklistTemplate tem muitos Items
ChecklistTemplate 1 ──< N ChecklistTemplateItem

// N:N (via ChecklistAnswer) - Submission responde Items
ChecklistSubmission N ──< ChecklistAnswer >── N ChecklistTemplateItem
```

---

## 🚀 Escalabilidade

### Preparação para Crescimento

**Atual (Single Instance):**
```
┌──────────┐
│ NestJS   │──────> PostgreSQL
│ Angular  │
└──────────┘
```

**Futuro (Horizontal Scaling):**
```
            ┌──────────┐
            │  NGINX   │
            └──────────┘
                 │
         ┌───────┼───────┐
         │       │       │
    ┌────▼──┐ ┌─▼────┐ ┌▼─────┐
    │NestJS │ │NestJS│ │NestJS│
    │   1   │ │   2  │ │   3  │
    └───────┘ └──────┘ └──────┘
         │       │       │
         └───────┼───────┘
                 │
         ┌───────▼────────┐
         │   PostgreSQL   │
         │   (Master +    │
         │    Read Replicas)
         └────────────────┘
```

**Recursos para Escalar:**
- ✅ Stateless (JWT, sem sessões)
- ✅ Preparado para Redis (cache de tokens)
- ✅ Preparado para CDN (assets estáticos)
- ✅ Queries otimizadas (índices em tenantId, date, etc)

---

## 📈 Performance

### Otimizações Implementadas

1. **Índices de Banco:**
```prisma
@@index([tenantId])        // Queries filtradas por empresa
@@index([tenantId, plate]) // Busca rápida por placa
@@index([date])            // Ordenação por data
@@index([status])          // Filtros de status
```

2. **Eager Loading:**
```typescript
// Carrega relacionamentos em uma query
return this.prisma.vehicle.findMany({
  include: {
    maintenances: { take: 5 },  // Últimas 5 manutenções
    fuelLogs: { take: 5 }       // Últimos 5 abastecimentos
  }
});
```

3. **Paginação (TODO):**
```typescript
// Implementar em todas as listagens
async findAll(tenantId: string, page = 1, limit = 20) {
  return this.prisma.vehicle.findMany({
    where: { tenantId },
    skip: (page - 1) * limit,
    take: limit
  });
}
```

---

## 🧪 Testes (TODO - Prioridade ALTA)

### Estratégia de Testes

```
backend/
├── test/
│   ├── auth.e2e-spec.ts       # Testes E2E de autenticação
│   ├── vehicles.e2e-spec.ts   # Testes E2E de veículos
│   └── multi-tenant.e2e-spec.ts  # Testes de isolamento
│
└── src/
    └── vehicles/
        ├── vehicles.service.spec.ts      # Testes unitários
        └── vehicles.controller.spec.ts   # Testes unitários
```

---

## 📦 Deploy

### Ambiente de Produção

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  backend:
    build: ./backend
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    ports:
      - "3000:3000"
  
  postgres:
    image: postgres:14
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=${DB_PASSWORD}

volumes:
  postgres_data:
```

---

## 🔮 Roadmap Técnico

### Próximos Passos

1. **Prioridade ALTA:**
   - [ ] Implementar testes (E2E + unitários)
   - [ ] Adicionar rate limiting (throttler)
   - [ ] Implementar refresh token
   - [ ] Logger estruturado (Winston/Pino)

2. **Prioridade MÉDIA:**
   - [ ] Cache com Redis
   - [ ] WebSockets para notificações real-time
   - [ ] Background jobs (BullMQ)
   - [ ] Soft delete global

3. **Prioridade BAIXA:**
   - [ ] GraphQL (Apollo)
   - [ ] Microserviços (separar módulos)
   - [ ] Event Sourcing
   - [ ] CQRS pattern

---

**Desenvolvido por PalsCorp © 2025**
