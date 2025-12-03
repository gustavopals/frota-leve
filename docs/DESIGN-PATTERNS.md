# 🎨 Padrões de Código - Frota Leve

**Guia oficial de padrões, convenções e boas práticas do projeto**

---

## 📋 Índice

1. [Backend Patterns](#-backend-patterns)
2. [Frontend Patterns](#-frontend-patterns)
3. [Database Patterns](#-database-patterns)
4. [API Design](#-api-design)
5. [Error Handling](#-error-handling)
6. [Naming Conventions](#-naming-conventions)

---

## 🔷 Backend Patterns

### 1. Controller Pattern

**Regra:** Todos os controllers seguem este template:

```typescript
import { 
  Controller, Get, Post, Put, Patch, Delete, 
  Body, Param, UseGuards, Query 
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TenantId } from '../common/decorators';

@ApiTags('vehicles')           // ← Tag para Swagger
@ApiBearerAuth()               // ← Indica autenticação JWT
@UseGuards(AuthGuard('jwt'))   // ← Protege TODAS as rotas
@Controller('vehicles')        // ← Rota base
export class VehiclesController {
  constructor(private readonly service: VehiclesService) {}

  @Post()
  create(
    @TenantId() tenantId: string,  // ← OBRIGATÓRIO para isolamento
    @Body() dto: CreateVehicleDto
  ) {
    return this.service.create(tenantId, dto);
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,  // ← SEMPRE primeiro parâmetro
    @Query('status') status?: string,
    @Query('search') search?: string
  ) {
    return this.service.findAll(tenantId, { status, search });
  }

  @Get(':id')
  findOne(
    @TenantId() tenantId: string,
    @Param('id') id: string
  ) {
    return this.service.findOne(tenantId, id);
  }

  @Patch(':id')
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVehicleDto
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Delete(':id')
  remove(
    @TenantId() tenantId: string,
    @Param('id') id: string
  ) {
    return this.service.remove(tenantId, id);
  }
}
```

**Checklist:**
- ✅ `@ApiTags()` com nome do recurso
- ✅ `@ApiBearerAuth()` em todos os controllers protegidos
- ✅ `@UseGuards(AuthGuard('jwt'))` a nível de classe
- ✅ `@TenantId()` decorator em TODOS os métodos
- ✅ DTOs tipados para `@Body()`
- ✅ Parâmetros de query opcionais (`?`)

---

### 2. Service Pattern

**Regra:** Todos os services seguem este template:

```typescript
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { CreateVehicleDto, UpdateVehicleDto } from './dto';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  // CREATE
  async create(tenantId: string, dto: CreateVehicleDto) {
    // Validações de negócio
    const existing = await this.prisma.vehicle.findFirst({
      where: { tenantId, plate: dto.plate }
    });
    
    if (existing) {
      throw new BadRequestException('Placa já cadastrada');
    }

    return this.prisma.vehicle.create({
      data: {
        ...dto,
        tenantId  // ← NUNCA esquecer de adicionar tenantId
      }
    });
  }

  // READ ALL
  async findAll(tenantId: string, filters?: { status?: string; search?: string }) {
    return this.prisma.vehicle.findMany({
      where: {
        tenantId,  // ← SEMPRE filtrar por tenantId
        ...(filters?.status && { status: filters.status }),
        ...(filters?.search && {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { plate: { contains: filters.search, mode: 'insensitive' } }
          ]
        })
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  // READ ONE
  async findOne(tenantId: string, id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, tenantId },  // ← Dupla verificação
      include: {
        maintenances: {
          take: 5,
          orderBy: { date: 'desc' }
        },
        fuelLogs: {
          take: 5,
          orderBy: { date: 'desc' }
        }
      }
    });

    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado');
    }

    return vehicle;
  }

  // UPDATE
  async update(tenantId: string, id: string, dto: UpdateVehicleDto) {
    // Verifica se existe E pertence ao tenant
    await this.findOne(tenantId, id);

    return this.prisma.vehicle.update({
      where: { id },
      data: dto
    });
  }

  // DELETE
  async remove(tenantId: string, id: string) {
    // Verifica se existe E pertence ao tenant
    await this.findOne(tenantId, id);

    return this.prisma.vehicle.delete({
      where: { id }
    });
  }

  // STATS (métodos adicionais)
  async getStats(tenantId: string) {
    const [total, active, maintenance] = await Promise.all([
      this.prisma.vehicle.count({ where: { tenantId } }),
      this.prisma.vehicle.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.vehicle.count({ where: { tenantId, status: 'MAINTENANCE' } })
    ]);

    return { total, active, maintenance };
  }
}
```

**Checklist:**
- ✅ `tenantId` SEMPRE como primeiro parâmetro
- ✅ `where: { tenantId }` em TODAS as queries
- ✅ `throw NotFoundException()` quando não encontrar
- ✅ Validações de negócio antes de criar/atualizar
- ✅ Métodos auxiliares (stats, analytics, etc.)

---

### 3. Module Pattern

**Regra:** Todos os módulos seguem este template:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../config/prisma.module';
import { VehiclesService } from './vehicles.service';
import { VehiclesController } from './vehicles.controller';

@Module({
  imports: [PrismaModule],       // ← Importa módulos necessários
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService]     // ← Exporta se outro módulo precisar
})
export class VehiclesModule {}
```

**Checklist:**
- ✅ `PrismaModule` em `imports` (se usar banco)
- ✅ Controllers registrados
- ✅ Services registrados em `providers`
- ✅ `exports` apenas se outro módulo consumir

---

### 4. DTO Pattern

**Regra:** Todos os DTOs seguem este template:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsString, IsNotEmpty, IsEnum, IsOptional, 
  IsNumber, Matches, Min, Max 
} from 'class-validator';

export class CreateVehicleDto {
  @ApiProperty({ description: 'Nome do veículo', example: 'Fiorino Branca' })
  @IsString()
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  name: string;

  @ApiProperty({ description: 'Placa do veículo', example: 'ABC1D23' })
  @IsString()
  @Matches(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/, {
    message: 'Placa inválida (formato: ABC1D23)'
  })
  plate: string;

  @ApiPropertyOptional({ description: 'Número do RENAVAM' })
  @IsString()
  @IsOptional()
  renavam?: string;

  @ApiProperty({ 
    description: 'Tipo do veículo', 
    enum: ['CAMINHONETE', 'VAN', 'PICKUP', 'MAQUINARIO']
  })
  @IsEnum(['CAMINHONETE', 'VAN', 'PICKUP', 'MAQUINARIO'])
  type: string;

  @ApiProperty({ description: 'Quilometragem atual', example: 50000 })
  @IsNumber()
  @Min(0, { message: 'Quilometragem não pode ser negativa' })
  currentOdometer: number;

  @ApiPropertyOptional({ 
    description: 'Status do veículo', 
    enum: ['ACTIVE', 'MAINTENANCE', 'SOLD', 'INACTIVE'],
    default: 'ACTIVE'
  })
  @IsEnum(['ACTIVE', 'MAINTENANCE', 'SOLD', 'INACTIVE'])
  @IsOptional()
  status?: string;
}
```

**Update DTO:**
```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateVehicleDto } from './create-vehicle.dto';

// Torna TODAS as propriedades opcionais
export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {}
```

**Checklist:**
- ✅ `@ApiProperty()` ou `@ApiPropertyOptional()` em todas as props
- ✅ Validators do `class-validator` (`@IsString`, `@IsNotEmpty`, etc.)
- ✅ Mensagens de erro em **português**
- ✅ Exemplos nos `@ApiProperty({ example: ... })`
- ✅ UpdateDTO usa `PartialType(CreateDTO)`

---

### 5. Decorator Pattern (Multi-tenant)

**@TenantId()** - Extrai tenantId do JWT:

```typescript
// common/decorators/tenant-id.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.tenantId;  // JWT payload: { sub, email, role, tenantId }
  }
);
```

**@CurrentUser()** - Extrai usuário completo:

```typescript
// common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;  // { sub, email, role, tenantId }
  }
);
```

**@Roles()** - Define roles permitidas:

```typescript
// common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

**Uso:**
```typescript
@Roles(UserRole.ADMIN_EMPRESA, UserRole.GESTOR_FROTA)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Delete(':id')
deleteUser(@TenantId() tenantId: string, @Param('id') id: string) {
  // Apenas ADMIN_EMPRESA ou GESTOR_FROTA podem deletar
}
```

---

## 🔶 Frontend Patterns

### 1. Component Pattern (Standalone)

**Regra:** Todos os componentes são standalone:

```typescript
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-vehicle-list',
  standalone: true,
  imports: [CommonModule, RouterLink],  // ← Importa dependências
  templateUrl: './vehicle-list.html',
  styleUrl: './vehicle-list.scss'
})
export class VehicleListComponent implements OnInit {
  // Signals para estado reativo
  vehicles = signal<Vehicle[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private vehicleService: VehicleService) {}

  ngOnInit() {
    this.loadVehicles();
  }

  async loadVehicles() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const data = await this.vehicleService.getAll();
      this.vehicles.set(data);
    } catch (err) {
      this.error.set('Erro ao carregar veículos');
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }
}
```

**Checklist:**
- ✅ `standalone: true`
- ✅ Imports explícitos (`CommonModule`, `RouterLink`, etc.)
- ✅ Signals para estado (`signal()`, `.set()`, `.update()`)
- ✅ Async/await para chamadas de API
- ✅ Try/catch para tratamento de erros

---

### 2. Service Pattern (HTTP)

**Regra:** Todos os services usam `ApiService`:

```typescript
import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/services/api';
import { Vehicle } from '@core/models/vehicle.model';

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private api = inject(ApiService);

  // GET /vehicles
  getAll(filters?: { status?: string; search?: string }) {
    return this.api.get<Vehicle[]>('/vehicles', filters);
  }

  // GET /vehicles/:id
  getById(id: string) {
    return this.api.get<Vehicle>(`/vehicles/${id}`);
  }

  // POST /vehicles
  create(data: Partial<Vehicle>) {
    return this.api.post<Vehicle>('/vehicles', data);
  }

  // PATCH /vehicles/:id
  update(id: string, data: Partial<Vehicle>) {
    return this.api.patch<Vehicle>(`/vehicles/${id}`, data);
  }

  // DELETE /vehicles/:id
  delete(id: string) {
    return this.api.delete<void>(`/vehicles/${id}`);
  }

  // GET /vehicles/stats
  getStats() {
    return this.api.get<{ total: number; active: number }>('/vehicles/stats');
  }
}
```

**Checklist:**
- ✅ `providedIn: 'root'` para singleton
- ✅ `inject()` ao invés de constructor injection
- ✅ Métodos retornam `Promise<T>` (async)
- ✅ Tipagem forte com generics (`<Vehicle>`, `<void>`)

---

### 3. Form Pattern (Reactive Forms)

**Regra:** Sempre usar `FormBuilder` + validação:

```typescript
import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { VehicleService } from '../../services/vehicle.service';

@Component({
  selector: 'app-vehicle-form',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './vehicle-form.html'
})
export class VehicleFormComponent implements OnInit {
  form!: FormGroup;
  loading = signal(false);

  constructor(
    private fb: FormBuilder,
    private service: VehicleService,
    private router: Router
  ) {}

  ngOnInit() {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      plate: ['', [Validators.required, Validators.pattern(/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/)]],
      type: ['', Validators.required],
      currentOdometer: [0, [Validators.required, Validators.min(0)]]
    });
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);

    try {
      await this.service.create(this.form.value);
      this.router.navigate(['/vehicles']);
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      this.loading.set(false);
    }
  }
}
```

**Template:**
```html
<form [formGroup]="form" (ngSubmit)="onSubmit()">
  <div class="form-group">
    <label class="block text-sm font-medium text-foreground mb-2">
      Nome do Veículo
    </label>
    <input 
      type="text" 
      formControlName="name"
      class="w-full px-4 py-2 bg-input border border-border rounded-lg
             focus:ring-2 focus:ring-primary"
      [class.border-red-500]="form.get('name')?.invalid && form.get('name')?.touched"
    />
    @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
      <p class="text-red-500 text-sm mt-1">Nome é obrigatório</p>
    }
  </div>

  <button 
    type="submit" 
    class="btn btn-primary"
    [disabled]="loading()"
  >
    {{ loading() ? 'Salvando...' : 'Salvar' }}
  </button>
</form>
```

**Checklist:**
- ✅ `ReactiveFormsModule` em imports
- ✅ `FormBuilder` para criar FormGroup
- ✅ Validators do Angular (`required`, `minLength`, `pattern`)
- ✅ `markAllAsTouched()` antes de validar
- ✅ Classes condicionais (`[class.border-red-500]`)
- ✅ Mensagens de erro em português

---

### 4. Routing Pattern

**app.routes.ts:**
```typescript
import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth-guard';

export const routes: Routes = [
  // Rotas públicas
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.routes)
  },

  // Rotas protegidas
  {
    path: '',
    canActivate: [authGuard],  // ← Guard em rotas privadas
    component: DashboardLayoutComponent,
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/pages/overview/overview')
          .then(m => m.OverviewComponent)
      },
      {
        path: 'vehicles',
        loadChildren: () => import('./features/vehicles/vehicles.routes').then(m => m.routes)
      }
    ]
  },

  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '/dashboard' }
];
```

**Checklist:**
- ✅ Lazy loading com `loadChildren` / `loadComponent`
- ✅ `authGuard` em rotas privadas
- ✅ Layout components como parent (DashboardLayoutComponent)
- ✅ Redirect padrão para 404

---

## 🔹 Database Patterns

### 1. Model Pattern (Prisma Schema)

**Regra:** Todos os models seguem este template:

```prisma
model Vehicle {
  // IDs
  id       String @id @default(uuid())
  tenantId String  // ← Chave de multi-tenancy

  // Campos de negócio
  name            String
  plate           String
  renavam         String?
  chassisNumber   String?
  type            String  // CAMINHONETE | VAN | PICKUP | MAQUINARIO
  brand           String?
  model           String?
  year            Int?
  currentOdometer Int     @default(0)
  status          VehicleStatus @default(ACTIVE)

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relacionamentos
  tenant       Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  maintenances Maintenance[]
  fuelLogs     FuelLog[]
  checklists   ChecklistSubmission[]
  reminders    Reminder[]

  // Índices
  @@index([tenantId])         // ← OBRIGATÓRIO para performance
  @@index([plate])            // ← Campos de busca frequente
  @@index([status])
  @@unique([tenantId, plate]) // ← Unique por tenant
}
```

**Checklist:**
- ✅ `id String @id @default(uuid())`
- ✅ `tenantId String` em TODOS os models (exceto Tenant)
- ✅ `createdAt` e `updatedAt` para auditoria
- ✅ `@@index([tenantId])` para queries multi-tenant
- ✅ `onDelete: Cascade` em FK de tenant
- ✅ Enums para status/tipos

---

### 2. Enum Pattern

```prisma
enum VehicleStatus {
  ACTIVE       // Em operação
  MAINTENANCE  // Em manutenção
  SOLD         // Vendido
  INACTIVE     // Inativo
}

enum UserRole {
  ADMIN_EMPRESA   // Dono da empresa
  GESTOR_FROTA    // Gerente de frota
  MOTORISTA       // Motorista
}
```

**Checklist:**
- ✅ Nomes em UPPER_CASE
- ✅ Valores em português nos comentários

---

## 🔸 API Design

### 1. RESTful Endpoints

```
Recurso: vehicles

POST   /vehicles           → Criar veículo
GET    /vehicles           → Listar veículos (com filtros)
GET    /vehicles/stats     → Estatísticas de veículos
GET    /vehicles/:id       → Detalhes de um veículo
PATCH  /vehicles/:id       → Atualizar veículo (parcial)
PUT    /vehicles/:id       → Atualizar veículo (completo)
DELETE /vehicles/:id       → Deletar veículo

// Subrecursos
PATCH  /vehicles/:id/odometer  → Atualizar apenas odômetro
GET    /vehicles/:id/maintenances  → Manutenções do veículo
```

**Checklist:**
- ✅ Plural para recursos (`/vehicles`, não `/vehicle`)
- ✅ PATCH para atualizações parciais
- ✅ PUT para atualizações completas
- ✅ Subrecursos via path (`/vehicles/:id/maintenances`)
- ✅ Métodos especiais via PATCH (`/odometer`)

---

### 2. Response Pattern

**Sucesso (200/201):**
```json
{
  "id": "uuid",
  "name": "Fiorino Branca",
  "plate": "ABC1D23",
  "status": "ACTIVE",
  "createdAt": "2025-12-03T10:00:00Z"
}
```

**Lista (200):**
```json
{
  "data": [
    { "id": "uuid1", "name": "Vehicle 1" },
    { "id": "uuid2", "name": "Vehicle 2" }
  ],
  "total": 2,
  "page": 1,
  "limit": 20
}
```

**Erro (400/404/500):**
```json
{
  "statusCode": 400,
  "message": "Placa já cadastrada",
  "error": "Bad Request"
}
```

**Checklist:**
- ✅ Datas em ISO 8601 (`2025-12-03T10:00:00Z`)
- ✅ Arrays com wrapper `{ data: [...] }`
- ✅ Mensagens de erro em português
- ✅ Status codes corretos (200, 201, 400, 404, 500)

---

## ⚠️ Error Handling

### 1. Backend (NestJS)

```typescript
import { 
  NotFoundException, 
  BadRequestException, 
  UnauthorizedException,
  ForbiddenException
} from '@nestjs/common';

// Not Found (404)
throw new NotFoundException('Veículo não encontrado');

// Bad Request (400)
throw new BadRequestException('Placa já cadastrada');

// Unauthorized (401)
throw new UnauthorizedException('Token inválido');

// Forbidden (403)
throw new ForbiddenException('Sem permissão para esta ação');
```

### 2. Frontend (Angular)

```typescript
try {
  await this.service.create(data);
} catch (error: any) {
  if (error.status === 400) {
    this.error.set(error.error.message);  // "Placa já cadastrada"
  } else if (error.status === 404) {
    this.error.set('Recurso não encontrado');
  } else {
    this.error.set('Erro inesperado. Tente novamente.');
  }
}
```

---

## 📝 Naming Conventions

### Backend

```typescript
// Classes: PascalCase
class VehiclesService {}
class CreateVehicleDto {}

// Métodos: camelCase
async findAll() {}
async getStats() {}

// Variáveis: camelCase
const tenantId = '...';
const vehicleData = {};

// Constantes: UPPER_SNAKE_CASE
const JWT_SECRET = process.env.JWT_SECRET;
const ROLES_KEY = 'roles';

// Arquivos: kebab-case
vehicles.service.ts
create-vehicle.dto.ts
tenant-id.decorator.ts
```

### Frontend

```typescript
// Componentes: PascalCase
class VehicleListComponent {}

// Services: PascalCase + Service
class VehicleService {}
class AuthService {}

// Interfaces/Models: PascalCase
interface Vehicle {}
interface User {}

// Signals/Variáveis: camelCase
const vehicles = signal([]);
const loading = signal(false);

// Arquivos: kebab-case
vehicle-list.component.ts
vehicle.service.ts
auth-guard.ts
```

### Database

```prisma
// Models: PascalCase Singular
model Vehicle {}
model FuelLog {}

// Campos: camelCase
field tenantId
field createdAt

// Enums: PascalCase
enum VehicleStatus {}

// Valores: UPPER_CASE
ACTIVE
ADMIN_EMPRESA
```

---

## ✅ Code Review Checklist

**Antes de commitar, verifique:**

### Backend
- [ ] `@TenantId()` em todos os métodos de controller?
- [ ] `where: { tenantId }` em todas as queries?
- [ ] DTOs com `@ApiProperty()` e validators?
- [ ] Mensagens de erro em português?
- [ ] `NotFoundException` quando não encontrar?
- [ ] Swagger tags e Bearer auth configurados?

### Frontend
- [ ] `standalone: true` nos componentes?
- [ ] Signals ao invés de variáveis normais?
- [ ] Try/catch em chamadas de API?
- [ ] Classes Tailwind semânticas (`bg-card`, não `bg-gray-800`)?
- [ ] Loading states implementados?
- [ ] Formulários com validação?

### Database
- [ ] `@@index([tenantId])` nos models?
- [ ] `onDelete: Cascade` em FKs de tenant?
- [ ] Campos obrigatórios sem `?`?
- [ ] Enums ao invés de strings livres?

---

**Desenvolvido por PalsCorp © 2025**
