# 📚 Exemplos de Código - Frota Leve

**Templates prontos para uso e referência rápida**

---

## 📋 Índice

1. [Backend - Novo Módulo Completo](#-backend---novo-módulo-completo)
2. [Backend - CRUD Simples](#-backend---crud-simples)
3. [Frontend - Página de Listagem](#-frontend---página-de-listagem)
4. [Frontend - Formulário](#-frontend---formulário)
5. [Integração API Completa](#-integração-api-completa)
6. [Testes](#-testes)

---

## 🔷 Backend - Novo Módulo Completo

### Exemplo: Módulo de "Despesas" (Expenses)

#### 1. Prisma Schema (`prisma/schema.prisma`)

```prisma
model Expense {
  id          String   @id @default(uuid())
  tenantId    String
  vehicleId   String?
  userId      String   // Quem registrou a despesa
  
  description String
  category    ExpenseCategory
  amount      Float
  date        DateTime
  receipt     String?  // URL do recibo (futuro: upload)
  notes       String?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  tenant  Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  vehicle Vehicle? @relation(fields: [vehicleId], references: [id], onDelete: SetNull)
  user    User     @relation(fields: [userId], references: [id])
  
  @@index([tenantId])
  @@index([vehicleId])
  @@index([date])
  @@index([category])
}

enum ExpenseCategory {
  COMBUSTIVEL    // Combustível
  MANUTENCAO     // Manutenção
  PEDAGIO        // Pedágio
  ESTACIONAMENTO // Estacionamento
  MULTA          // Multa
  SEGURO         // Seguro
  OUTROS         // Outros
}
```

**Migration:**
```bash
cd backend
npx prisma migrate dev --name add_expense_module
```

---

#### 2. DTOs (`src/expenses/dto/`)

**create-expense.dto.ts:**
```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsEnum, IsOptional, IsDateString, Min } from 'class-validator';

export class CreateExpenseDto {
  @ApiPropertyOptional({ description: 'ID do veículo (opcional)' })
  @IsString()
  @IsOptional()
  vehicleId?: string;

  @ApiProperty({ description: 'Descrição da despesa', example: 'Troca de óleo' })
  @IsString()
  @IsNotEmpty({ message: 'Descrição é obrigatória' })
  description: string;

  @ApiProperty({ 
    description: 'Categoria da despesa',
    enum: ['COMBUSTIVEL', 'MANUTENCAO', 'PEDAGIO', 'ESTACIONAMENTO', 'MULTA', 'SEGURO', 'OUTROS']
  })
  @IsEnum(['COMBUSTIVEL', 'MANUTENCAO', 'PEDAGIO', 'ESTACIONAMENTO', 'MULTA', 'SEGURO', 'OUTROS'])
  category: string;

  @ApiProperty({ description: 'Valor da despesa', example: 350.50 })
  @IsNumber()
  @Min(0.01, { message: 'Valor deve ser maior que zero' })
  amount: number;

  @ApiProperty({ description: 'Data da despesa', example: '2025-12-03' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ description: 'Observações' })
  @IsString()
  @IsOptional()
  notes?: string;
}
```

**update-expense.dto.ts:**
```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateExpenseDto } from './create-expense.dto';

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}
```

**index.ts:**
```typescript
export * from './create-expense.dto';
export * from './update-expense.dto';
```

---

#### 3. Service (`src/expenses/expenses.service.ts`)

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, userId: string, dto: CreateExpenseDto) {
    // Valida se o veículo pertence ao tenant (se informado)
    if (dto.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: { id: dto.vehicleId, tenantId }
      });
      
      if (!vehicle) {
        throw new NotFoundException('Veículo não encontrado');
      }
    }

    return this.prisma.expense.create({
      data: {
        ...dto,
        tenantId,
        userId,
        date: new Date(dto.date)
      },
      include: {
        vehicle: { select: { name: true, plate: true } },
        user: { select: { name: true, email: true } }
      }
    });
  }

  async findAll(
    tenantId: string, 
    filters?: { 
      vehicleId?: string; 
      category?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    return this.prisma.expense.findMany({
      where: {
        tenantId,
        ...(filters?.vehicleId && { vehicleId: filters.vehicleId }),
        ...(filters?.category && { category: filters.category }),
        ...(filters?.startDate && filters?.endDate && {
          date: {
            gte: new Date(filters.startDate),
            lte: new Date(filters.endDate)
          }
        })
      },
      include: {
        vehicle: { select: { name: true, plate: true } },
        user: { select: { name: true } }
      },
      orderBy: { date: 'desc' }
    });
  }

  async findOne(tenantId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, tenantId },
      include: {
        vehicle: true,
        user: { select: { name: true, email: true } }
      }
    });

    if (!expense) {
      throw new NotFoundException('Despesa não encontrada');
    }

    return expense;
  }

  async update(tenantId: string, id: string, dto: UpdateExpenseDto) {
    await this.findOne(tenantId, id);

    return this.prisma.expense.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.date && { date: new Date(dto.date) })
      },
      include: {
        vehicle: { select: { name: true, plate: true } }
      }
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    return this.prisma.expense.delete({
      where: { id }
    });
  }

  // Métodos de analytics
  async getStats(tenantId: string, filters?: { startDate?: string; endDate?: string }) {
    const where: any = { tenantId };
    
    if (filters?.startDate && filters?.endDate) {
      where.date = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate)
      };
    }

    const [totalExpenses, byCategory] = await Promise.all([
      this.prisma.expense.aggregate({
        where,
        _sum: { amount: true },
        _count: true
      }),
      this.prisma.expense.groupBy({
        by: ['category'],
        where,
        _sum: { amount: true },
        _count: true
      })
    ]);

    return {
      total: totalExpenses._sum.amount || 0,
      count: totalExpenses._count,
      byCategory
    };
  }
}
```

---

#### 4. Controller (`src/expenses/expenses.controller.ts`)

```typescript
import { 
  Controller, Get, Post, Patch, Delete, 
  Body, Param, Query, UseGuards 
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TenantId, CurrentUser } from '../common/decorators';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto';

@ApiTags('expenses')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly service: ExpensesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar nova despesa' })
  create(
    @TenantId() tenantId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateExpenseDto
  ) {
    return this.service.create(tenantId, userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar despesas' })
  findAll(
    @TenantId() tenantId: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.service.findAll(tenantId, { vehicleId, category, startDate, endDate });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de despesas' })
  getStats(
    @TenantId() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.service.getStats(tenantId, { startDate, endDate });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar despesa por ID' })
  findOne(
    @TenantId() tenantId: string,
    @Param('id') id: string
  ) {
    return this.service.findOne(tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar despesa' })
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto
  ) {
    return this.service.update(tenantId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deletar despesa' })
  remove(
    @TenantId() tenantId: string,
    @Param('id') id: string
  ) {
    return this.service.remove(tenantId, id);
  }
}
```

---

#### 5. Module (`src/expenses/expenses.module.ts`)

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../config/prisma.module';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService]
})
export class ExpensesModule {}
```

---

#### 6. Registrar no App Module (`src/app.module.ts`)

```typescript
import { ExpensesModule } from './expenses/expenses.module';

@Module({
  imports: [
    // ... outros módulos
    ExpensesModule  // ← Adicionar aqui
  ]
})
export class AppModule {}
```

---

## 🔶 Frontend - Página de Listagem

### Exemplo: Lista de Despesas

#### 1. Model (`src/app/core/models/expense.model.ts`)

```typescript
export interface Expense {
  id: string;
  tenantId: string;
  vehicleId?: string;
  userId: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  
  // Relacionamentos
  vehicle?: {
    name: string;
    plate: string;
  };
  user?: {
    name: string;
  };
}

export type ExpenseCategory = 
  | 'COMBUSTIVEL' 
  | 'MANUTENCAO' 
  | 'PEDAGIO' 
  | 'ESTACIONAMENTO' 
  | 'MULTA' 
  | 'SEGURO' 
  | 'OUTROS';

export const EXPENSE_CATEGORIES = {
  COMBUSTIVEL: 'Combustível',
  MANUTENCAO: 'Manutenção',
  PEDAGIO: 'Pedágio',
  ESTACIONAMENTO: 'Estacionamento',
  MULTA: 'Multa',
  SEGURO: 'Seguro',
  OUTROS: 'Outros'
};
```

---

#### 2. Service (`src/app/features/expenses/services/expense.service.ts`)

```typescript
import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/services/api';
import { Expense } from '@core/models/expense.model';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private api = inject(ApiService);

  getAll(filters?: { vehicleId?: string; category?: string; startDate?: string; endDate?: string }) {
    return this.api.get<Expense[]>('/expenses', filters);
  }

  getById(id: string) {
    return this.api.get<Expense>(`/expenses/${id}`);
  }

  create(data: Partial<Expense>) {
    return this.api.post<Expense>('/expenses', data);
  }

  update(id: string, data: Partial<Expense>) {
    return this.api.patch<Expense>(`/expenses/${id}`, data);
  }

  delete(id: string) {
    return this.api.delete<void>(`/expenses/${id}`);
  }

  getStats(filters?: { startDate?: string; endDate?: string }) {
    return this.api.get<{ total: number; count: number }>('/expenses/stats', filters);
  }
}
```

---

#### 3. Component (`src/app/features/expenses/pages/expense-list/expense-list.ts`)

```typescript
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ExpenseService } from '../../services/expense.service';
import { Expense, EXPENSE_CATEGORIES } from '@core/models/expense.model';

@Component({
  selector: 'app-expense-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './expense-list.html'
})
export class ExpenseListComponent implements OnInit {
  expenses = signal<Expense[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  
  // Filtros
  selectedCategory = signal<string | null>(null);
  searchTerm = signal('');

  // Computed (filtros aplicados)
  filteredExpenses = computed(() => {
    let result = this.expenses();
    
    if (this.selectedCategory()) {
      result = result.filter(e => e.category === this.selectedCategory());
    }
    
    if (this.searchTerm()) {
      const term = this.searchTerm().toLowerCase();
      result = result.filter(e => 
        e.description.toLowerCase().includes(term) ||
        e.vehicle?.plate.toLowerCase().includes(term)
      );
    }
    
    return result;
  });

  totalAmount = computed(() => 
    this.filteredExpenses().reduce((sum, e) => sum + e.amount, 0)
  );

  categories = Object.entries(EXPENSE_CATEGORIES);

  constructor(private service: ExpenseService) {}

  ngOnInit() {
    this.loadExpenses();
  }

  async loadExpenses() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const data = await this.service.getAll();
      this.expenses.set(data);
    } catch (err: any) {
      this.error.set('Erro ao carregar despesas');
      console.error(err);
    } finally {
      this.loading.set(false);
    }
  }

  async deleteExpense(id: string) {
    if (!confirm('Deseja realmente excluir esta despesa?')) return;

    try {
      await this.service.delete(id);
      this.expenses.update(list => list.filter(e => e.id !== id));
    } catch (err) {
      alert('Erro ao excluir despesa');
    }
  }

  getCategoryLabel(category: string): string {
    return EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES] || category;
  }
}
```

---

#### 4. Template (`expense-list.html`)

```html
<div class="space-y-6">
  <!-- Header -->
  <div class="flex justify-between items-center">
    <h1 class="text-3xl font-bold text-foreground">Despesas</h1>
    <a 
      routerLink="/expenses/new" 
      class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
    >
      Nova Despesa
    </a>
  </div>

  <!-- Filtros -->
  <div class="bg-card border border-border rounded-lg p-4 space-y-4">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Busca -->
      <input 
        type="text" 
        placeholder="Buscar por descrição ou placa..."
        [value]="searchTerm()"
        (input)="searchTerm.set($any($event.target).value)"
        class="px-4 py-2 bg-input border border-border rounded-lg"
      />

      <!-- Categoria -->
      <select 
        [value]="selectedCategory() || ''"
        (change)="selectedCategory.set($any($event.target).value || null)"
        class="px-4 py-2 bg-input border border-border rounded-lg"
      >
        <option value="">Todas as categorias</option>
        @for (cat of categories; track cat[0]) {
          <option [value]="cat[0]">{{ cat[1] }}</option>
        }
      </select>
    </div>

    <!-- Total -->
    <div class="text-right">
      <span class="text-sm text-muted-foreground">Total: </span>
      <span class="text-2xl font-bold text-foreground">
        {{ totalAmount() | currency: 'BRL' }}
      </span>
    </div>
  </div>

  <!-- Loading -->
  @if (loading()) {
    <div class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      <p class="mt-4 text-muted-foreground">Carregando...</p>
    </div>
  }

  <!-- Error -->
  @else if (error()) {
    <div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
      {{ error() }}
    </div>
  }

  <!-- Empty State -->
  @else if (filteredExpenses().length === 0) {
    <div class="text-center py-12">
      <p class="text-muted-foreground">Nenhuma despesa encontrada</p>
      <a routerLink="/expenses/new" class="text-primary hover:underline mt-2 inline-block">
        Criar primeira despesa
      </a>
    </div>
  }

  <!-- Lista -->
  @else {
    <div class="bg-card border border-border rounded-lg overflow-hidden">
      <table class="w-full">
        <thead class="bg-muted/50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Data</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Descrição</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Categoria</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Veículo</th>
            <th class="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Valor</th>
            <th class="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          @for (expense of filteredExpenses(); track expense.id) {
            <tr class="hover:bg-muted/30 transition-colors">
              <td class="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                {{ expense.date | date: 'dd/MM/yyyy' }}
              </td>
              <td class="px-6 py-4 text-sm text-foreground">
                {{ expense.description }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <span class="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs">
                  {{ getCategoryLabel(expense.category) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                {{ expense.vehicle?.plate || '-' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-foreground">
                {{ expense.amount | currency: 'BRL' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                <a 
                  [routerLink]="['/expenses', expense.id]" 
                  class="text-primary hover:underline"
                >
                  Editar
                </a>
                <button 
                  (click)="deleteExpense(expense.id)"
                  class="text-red-600 hover:underline"
                >
                  Excluir
                </button>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  }
</div>
```

---

## 🔹 Frontend - Formulário

### Exemplo: Formulário de Despesas

#### Component (`expense-form.ts`)

```typescript
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ExpenseService } from '../../services/expense.service';
import { VehicleService } from '@features/vehicles/services/vehicle.service';
import { EXPENSE_CATEGORIES } from '@core/models/expense.model';

@Component({
  selector: 'app-expense-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './expense-form.html'
})
export class ExpenseFormComponent implements OnInit {
  form!: FormGroup;
  loading = signal(false);
  isEdit = signal(false);
  expenseId: string | null = null;

  categories = Object.entries(EXPENSE_CATEGORIES);
  vehicles = signal<any[]>([]);

  constructor(
    private fb: FormBuilder,
    private service: ExpenseService,
    private vehicleService: VehicleService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  async ngOnInit() {
    this.expenseId = this.route.snapshot.paramMap.get('id');
    this.isEdit.set(!!this.expenseId);

    this.buildForm();
    await this.loadVehicles();

    if (this.expenseId) {
      await this.loadExpense(this.expenseId);
    }
  }

  buildForm() {
    this.form = this.fb.group({
      vehicleId: [''],
      description: ['', [Validators.required, Validators.minLength(3)]],
      category: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      date: [new Date().toISOString().split('T')[0], Validators.required],
      notes: ['']
    });
  }

  async loadVehicles() {
    try {
      const data = await this.vehicleService.getAll({ status: 'ACTIVE' });
      this.vehicles.set(data);
    } catch (err) {
      console.error('Erro ao carregar veículos:', err);
    }
  }

  async loadExpense(id: string) {
    try {
      const expense = await this.service.getById(id);
      this.form.patchValue({
        vehicleId: expense.vehicleId || '',
        description: expense.description,
        category: expense.category,
        amount: expense.amount,
        date: expense.date.split('T')[0],
        notes: expense.notes || ''
      });
    } catch (err) {
      alert('Erro ao carregar despesa');
      this.router.navigate(['/expenses']);
    }
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);

    try {
      const data = {
        ...this.form.value,
        vehicleId: this.form.value.vehicleId || undefined
      };

      if (this.expenseId) {
        await this.service.update(this.expenseId, data);
      } else {
        await this.service.create(data);
      }

      this.router.navigate(['/expenses']);
    } catch (error: any) {
      alert(error.error?.message || 'Erro ao salvar despesa');
    } finally {
      this.loading.set(false);
    }
  }
}
```

#### Template (`expense-form.html`)

```html
<div class="max-w-2xl mx-auto">
  <h1 class="text-3xl font-bold text-foreground mb-6">
    {{ isEdit() ? 'Editar Despesa' : 'Nova Despesa' }}
  </h1>

  <form [formGroup]="form" (ngSubmit)="onSubmit()" class="bg-card border border-border rounded-lg p-6 space-y-6">
    <!-- Veículo -->
    <div>
      <label class="block text-sm font-medium text-foreground mb-2">
        Veículo (Opcional)
      </label>
      <select 
        formControlName="vehicleId"
        class="w-full px-4 py-2 bg-input border border-border rounded-lg focus:ring-2 focus:ring-primary"
      >
        <option value="">Selecione um veículo</option>
        @for (vehicle of vehicles(); track vehicle.id) {
          <option [value]="vehicle.id">{{ vehicle.name }} - {{ vehicle.plate }}</option>
        }
      </select>
    </div>

    <!-- Descrição -->
    <div>
      <label class="block text-sm font-medium text-foreground mb-2">
        Descrição *
      </label>
      <input 
        type="text" 
        formControlName="description"
        placeholder="Ex: Troca de óleo"
        class="w-full px-4 py-2 bg-input border border-border rounded-lg focus:ring-2 focus:ring-primary"
        [class.border-red-500]="form.get('description')?.invalid && form.get('description')?.touched"
      />
      @if (form.get('description')?.hasError('required') && form.get('description')?.touched) {
        <p class="text-red-500 text-sm mt-1">Descrição é obrigatória</p>
      }
    </div>

    <!-- Categoria e Valor -->
    <div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-foreground mb-2">
          Categoria *
        </label>
        <select 
          formControlName="category"
          class="w-full px-4 py-2 bg-input border border-border rounded-lg focus:ring-2 focus:ring-primary"
          [class.border-red-500]="form.get('category')?.invalid && form.get('category')?.touched"
        >
          <option value="">Selecione</option>
          @for (cat of categories; track cat[0]) {
            <option [value]="cat[0]">{{ cat[1] }}</option>
          }
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-foreground mb-2">
          Valor (R$) *
        </label>
        <input 
          type="number" 
          step="0.01"
          formControlName="amount"
          class="w-full px-4 py-2 bg-input border border-border rounded-lg focus:ring-2 focus:ring-primary"
          [class.border-red-500]="form.get('amount')?.invalid && form.get('amount')?.touched"
        />
      </div>
    </div>

    <!-- Data -->
    <div>
      <label class="block text-sm font-medium text-foreground mb-2">
        Data *
      </label>
      <input 
        type="date" 
        formControlName="date"
        class="w-full px-4 py-2 bg-input border border-border rounded-lg focus:ring-2 focus:ring-primary"
      />
    </div>

    <!-- Observações -->
    <div>
      <label class="block text-sm font-medium text-foreground mb-2">
        Observações
      </label>
      <textarea 
        formControlName="notes"
        rows="3"
        class="w-full px-4 py-2 bg-input border border-border rounded-lg focus:ring-2 focus:ring-primary"
      ></textarea>
    </div>

    <!-- Botões -->
    <div class="flex gap-4">
      <button 
        type="submit" 
        class="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
        [disabled]="loading()"
      >
        {{ loading() ? 'Salvando...' : 'Salvar' }}
      </button>
      <button 
        type="button"
        (click)="router.navigate(['/expenses'])"
        class="px-6 py-3 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80"
      >
        Cancelar
      </button>
    </div>
  </form>
</div>
```

---

## ✅ Checklist para Novo Módulo

**Backend:**
- [ ] Criar model no `schema.prisma`
- [ ] Rodar `prisma migrate dev --name nome_migration`
- [ ] Criar DTOs (`create-*.dto.ts`, `update-*.dto.ts`)
- [ ] Criar Service com CRUD + validações
- [ ] Criar Controller com decorators
- [ ] Criar Module e registrar no `app.module.ts`
- [ ] Testar no Swagger (`/api`)

**Frontend:**
- [ ] Criar model em `core/models/`
- [ ] Criar service em `features/*/services/`
- [ ] Criar página de listagem
- [ ] Criar página de formulário
- [ ] Criar routes em `*.routes.ts`
- [ ] Adicionar menu no sidebar

---

**Desenvolvido por PalsCorp © 2025**
