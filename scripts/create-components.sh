#!/bin/bash

# Script para criar toda estrutura de componentes do frontend
# Execute com: bash create-components.sh

cd /opt/frota-leve/frontend

echo "🎨 Criando estrutura completa do frontend..."

# ===============================
# ENVIRONMENT
# ===============================
echo "📝 Criando environments..."

cat > src/environments/environment.ts << 'EOF'
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000'
};
EOF

cat > src/environments/environment.development.ts << 'EOF'
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000'
};
EOF

# ===============================
# MODELS
# ===============================
echo "📦 Criando models..."

cat > src/app/core/models/user.model.ts << 'EOF'
export enum UserRole {
  ADMIN_EMPRESA = 'ADMIN_EMPRESA',
  GESTOR_FROTA = 'GESTOR_FROTA',
  MOTORISTA = 'MOTORISTA'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantId: string;
  createdAt: Date;
}
EOF

cat > src/app/core/models/vehicle.model.ts << 'EOF'
export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  chassisNumber?: string;
  renavam?: string;
  currentKm: number;
  fuelType: string;
  status: 'ATIVO' | 'MANUTENCAO' | 'INATIVO';
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVehicleDto {
  plate: string;
  brand: string;
  model: string;
  year: number;
  color?: string;
  chassisNumber?: string;
  renavam?: string;
  currentKm: number;
  fuelType: string;
}
EOF

# ===============================
# ROUTING
# ===============================
echo "🛣️  Criando rotas..."

cat > src/app/app.routes.ts << 'EOF'
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES)
  },
  {
    path: 'vehicles',
    canActivate: [authGuard],
    loadChildren: () => import('./features/vehicles/vehicles.routes').then(m => m.VEHICLES_ROUTES)
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
EOF

# ===============================
# AUTH FEATURE
# ===============================
echo "🔐 Criando módulo de autenticação..."

# Auth Routes
cat > src/app/features/auth/auth.routes.ts << 'EOF'
import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  }
];
EOF

# Login Component
cat > src/app/features/auth/pages/login/login.component.ts << 'EOF'
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent, CardHeaderComponent, CardTitleComponent, CardDescriptionComponent, CardContentComponent, CardFooterComponent } from '../../../../shared/components/card/card.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent,
    CardFooterComponent
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid && !this.loading) {
      this.loading = true;
      this.errorMessage = '';

      this.authService.login(this.loginForm.value).subscribe({
        next: () => {
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          this.errorMessage = error.error?.message || 'Erro ao fazer login. Verifique suas credenciais.';
          this.loading = false;
        },
        complete: () => {
          this.loading = false;
        }
      });
    }
  }
}
EOF

cat > src/app/features/auth/pages/login/login.component.html << 'EOF'
<div class="min-h-screen flex items-center justify-center bg-background p-4">
  <div class="w-full max-w-md">
    <app-card>
      <app-card-header class="text-center">
        <app-card-title>Bem-vindo ao Frota Leve</app-card-title>
        <app-card-description>Faça login para acessar sua conta</app-card-description>
      </app-card-header>
      
      <app-card-content>
        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
          <div class="space-y-4">
            <!-- Email -->
            <div>
              <label for="email" class="block text-sm font-medium mb-2">Email</label>
              <input
                id="email"
                type="email"
                formControlName="email"
                class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="seu@email.com"
              />
              <div *ngIf="loginForm.get('email')?.invalid && loginForm.get('email')?.touched" class="text-sm text-destructive mt-1">
                Email inválido
              </div>
            </div>

            <!-- Password -->
            <div>
              <label for="password" class="block text-sm font-medium mb-2">Senha</label>
              <input
                id="password"
                type="password"
                formControlName="password"
                class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
              />
              <div *ngIf="loginForm.get('password')?.invalid && loginForm.get('password')?.touched" class="text-sm text-destructive mt-1">
                Senha deve ter no mínimo 6 caracteres
              </div>
            </div>

            <!-- Error Message -->
            <div *ngIf="errorMessage" class="p-3 text-sm bg-destructive/10 text-destructive rounded-md">
              {{ errorMessage }}
            </div>

            <!-- Submit Button -->
            <app-button
              type="submit"
              variant="default"
              [disabled]="loginForm.invalid"
              [loading]="loading"
              class="w-full"
            >
              {{ loading ? 'Entrando...' : 'Entrar' }}
            </app-button>
          </div>
        </form>
      </app-card-content>

      <app-card-footer class="justify-center">
        <p class="text-sm text-muted-foreground">
          Não tem uma conta?
          <a routerLink="/auth/register" class="text-primary hover:underline ml-1">Registre-se</a>
        </p>
      </app-card-footer>
    </app-card>
  </div>
</div>
EOF

cat > src/app/features/auth/pages/login/login.component.scss << 'EOF'
// Estilos adicionais se necessário
EOF

# Register Component
cat > src/app/features/auth/pages/register/register.component.ts << 'EOF'
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent, CardHeaderComponent, CardTitleComponent, CardDescriptionComponent, CardContentComponent, CardFooterComponent } from '../../../../shared/components/card/card.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent,
    CardFooterComponent
  ],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  registerForm: FormGroup;
  loading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      tenantName: ['', Validators.required],
      tenantDocument: [''],
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null : { 'mismatch': true };
  }

  onSubmit(): void {
    if (this.registerForm.valid && !this.loading) {
      this.loading = true;
      this.errorMessage = '';

      const { confirmPassword, ...registerData } = this.registerForm.value;

      this.authService.register(registerData).subscribe({
        next: () => {
          this.router.navigate(['/dashboard']);
        },
        error: (error) => {
          this.errorMessage = error.error?.message || 'Erro ao criar conta.';
          this.loading = false;
        },
        complete: () => {
          this.loading = false;
        }
      });
    }
  }
}
EOF

cat > src/app/features/auth/pages/register/register.component.html << 'EOF'
<div class="min-h-screen flex items-center justify-center bg-background p-4">
  <div class="w-full max-w-md">
    <app-card>
      <app-card-header class="text-center">
        <app-card-title>Criar Conta</app-card-title>
        <app-card-description>Preencha os dados para começar</app-card-description>
      </app-card-header>
      
      <app-card-content>
        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">Nome da Empresa</label>
              <input
                type="text"
                formControlName="tenantName"
                class="w-full px-3 py-2 border border-input rounded-md bg-background"
                placeholder="Minha Empresa Ltda"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">CNPJ (opcional)</label>
              <input
                type="text"
                formControlName="tenantDocument"
                class="w-full px-3 py-2 border border-input rounded-md bg-background"
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Seu Nome</label>
              <input
                type="text"
                formControlName="name"
                class="w-full px-3 py-2 border border-input rounded-md bg-background"
                placeholder="João Silva"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                formControlName="email"
                class="w-full px-3 py-2 border border-input rounded-md bg-background"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Senha</label>
              <input
                type="password"
                formControlName="password"
                class="w-full px-3 py-2 border border-input rounded-md bg-background"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Confirmar Senha</label>
              <input
                type="password"
                formControlName="confirmPassword"
                class="w-full px-3 py-2 border border-input rounded-md bg-background"
                placeholder="••••••••"
              />
              <div *ngIf="registerForm.errors?.['mismatch'] && registerForm.get('confirmPassword')?.touched" class="text-sm text-destructive mt-1">
                As senhas não coincidem
              </div>
            </div>

            <div *ngIf="errorMessage" class="p-3 text-sm bg-destructive/10 text-destructive rounded-md">
              {{ errorMessage }}
            </div>

            <app-button
              type="submit"
              variant="default"
              [disabled]="registerForm.invalid"
              [loading]="loading"
              class="w-full"
            >
              {{ loading ? 'Criando conta...' : 'Criar Conta' }}
            </app-button>
          </div>
        </form>
      </app-card-content>

      <app-card-footer class="justify-center">
        <p class="text-sm text-muted-foreground">
          Já tem uma conta?
          <a routerLink="/auth/login" class="text-primary hover:underline ml-1">Faça login</a>
        </p>
      </app-card-footer>
    </app-card>
  </div>
</div>
EOF

# ===============================
# DASHBOARD FEATURE
# ===============================
echo "📊 Criando módulo de dashboard..."

cat > src/app/features/dashboard/dashboard.routes.ts << 'EOF'
import { Routes } from '@angular/router';
import { DashboardLayoutComponent } from './dashboard-layout.component';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    component: DashboardLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/overview/overview.component').then(m => m.OverviewComponent)
      }
    ]
  }
];
EOF

cat > src/app/features/dashboard/dashboard-layout.component.ts << 'EOF'
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, SidebarComponent],
  template: `
    <div class="min-h-screen bg-background">
      <app-navbar></app-navbar>
      <div class="flex">
        <app-sidebar class="hidden lg:block"></app-sidebar>
        <main class="flex-1 p-6">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `
})
export class DashboardLayoutComponent {}
EOF

cat > src/app/features/dashboard/pages/overview/overview.component.ts << 'EOF'
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, CardHeaderComponent, CardTitleComponent, CardContentComponent } from '../../../../shared/components/card/card.component';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card.component';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardContentComponent,
    StatCardComponent
  ],
  templateUrl: './overview.component.html'
})
export class OverviewComponent implements OnInit {
  stats = [
    { title: 'Total de Veículos', value: '0', icon: '🚗' },
    { title: 'Manutenções Pendentes', value: '0', icon: '🔧' },
    { title: 'Abastecimentos (Mês)', value: '0', icon: '⛽' },
    { title: 'Motoristas Ativos', value: '0', icon: '👤' }
  ];

  ngOnInit() {
    // TODO: Load real data from API
  }
}
EOF

cat > src/app/features/dashboard/pages/overview/overview.component.html << 'EOF'
<div class="space-y-6">
  <div>
    <h1 class="text-3xl font-bold">Dashboard</h1>
    <p class="text-muted-foreground">Visão geral da sua frota</p>
  </div>

  <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    <app-stat-card
      *ngFor="let stat of stats"
      [title]="stat.title"
      [value]="stat.value"
      [icon]="stat.icon"
    ></app-stat-card>
  </div>

  <div class="grid gap-4 md:grid-cols-2">
    <app-card>
      <app-card-header>
        <app-card-title>Últimas Atividades</app-card-title>
      </app-card-header>
      <app-card-content>
        <p class="text-sm text-muted-foreground">Nenhuma atividade recente</p>
      </app-card-content>
    </app-card>

    <app-card>
      <app-card-header>
        <app-card-title>Alertas</app-card-title>
      </app-card-header>
      <app-card-content>
        <p class="text-sm text-muted-foreground">Sem alertas no momento</p>
      </app-card-content>
    </app-card>
  </div>
</div>
EOF

# ===============================
# VEHICLES FEATURE
# ===============================
echo "🚗 Criando módulo de veículos..."

cat > src/app/features/vehicles/vehicles.routes.ts << 'EOF'
import { Routes } from '@angular/router';

export const VEHICLES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/vehicle-list/vehicle-list.component').then(m => m.VehicleListComponent)
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/vehicle-form/vehicle-form.component').then(m => m.VehicleFormComponent)
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./pages/vehicle-form/vehicle-form.component').then(m => m.VehicleFormComponent)
  }
];
EOF

cat > src/app/features/vehicles/pages/vehicle-list/vehicle-list.component.ts << 'EOF'
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { Vehicle } from '../../../../core/models/vehicle.model';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent, CardHeaderComponent, CardTitleComponent, CardDescriptionComponent, CardContentComponent } from '../../../../shared/components/card/card.component';

@Component({
  selector: 'app-vehicle-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ButtonComponent,
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardDescriptionComponent,
    CardContentComponent
  ],
  templateUrl: './vehicle-list.component.html'
})
export class VehicleListComponent implements OnInit {
  vehicles: Vehicle[] = [];
  loading = true;

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.loadVehicles();
  }

  loadVehicles() {
    this.loading = true;
    this.apiService.get<Vehicle[]>('/vehicles').subscribe({
      next: (data) => {
        this.vehicles = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading vehicles:', error);
        this.loading = false;
      }
    });
  }
}
EOF

cat > src/app/features/vehicles/pages/vehicle-list/vehicle-list.component.html << 'EOF'
<div class="space-y-6">
  <div class="flex justify-between items-center">
    <div>
      <h1 class="text-3xl font-bold">Veículos</h1>
      <p class="text-muted-foreground">Gerencie sua frota</p>
    </div>
    <a routerLink="/vehicles/new">
      <app-button variant="default">+ Novo Veículo</app-button>
    </a>
  </div>

  <app-card>
    <app-card-content>
      <div *ngIf="loading" class="py-8 text-center text-muted-foreground">
        Carregando veículos...
      </div>

      <div *ngIf="!loading && vehicles.length === 0" class="py-8 text-center">
        <p class="text-muted-foreground mb-4">Nenhum veículo cadastrado</p>
        <a routerLink="/vehicles/new">
          <app-button variant="outline">Cadastrar Primeiro Veículo</app-button>
        </a>
      </div>

      <div *ngIf="!loading && vehicles.length > 0" class="overflow-x-auto">
        <table class="w-full">
          <thead class="border-b">
            <tr class="text-left">
              <th class="pb-3 font-medium">Placa</th>
              <th class="pb-3 font-medium">Marca/Modelo</th>
              <th class="pb-3 font-medium">Ano</th>
              <th class="pb-3 font-medium">KM Atual</th>
              <th class="pb-3 font-medium">Status</th>
              <th class="pb-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let vehicle of vehicles" class="border-b last:border-0">
              <td class="py-3">{{ vehicle.plate }}</td>
              <td class="py-3">{{ vehicle.brand }} {{ vehicle.model }}</td>
              <td class="py-3">{{ vehicle.year }}</td>
              <td class="py-3">{{ vehicle.currentKm | number }} km</td>
              <td class="py-3">
                <span
                  [class]="vehicle.status === 'ATIVO' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'"
                  class="px-2 py-1 rounded-full text-xs"
                >
                  {{ vehicle.status }}
                </span>
              </td>
              <td class="py-3">
                <a [routerLink]="['/vehicles', vehicle.id, 'edit']" class="text-primary hover:underline text-sm">
                  Editar
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </app-card-content>
  </app-card>
</div>
EOF

cat > src/app/features/vehicles/pages/vehicle-form/vehicle-form.component.ts << 'EOF'
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../../core/services/api.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent, CardHeaderComponent, CardTitleComponent, CardContentComponent } from '../../../../shared/components/card/card.component';

@Component({
  selector: 'app-vehicle-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonComponent,
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardContentComponent
  ],
  templateUrl: './vehicle-form.component.html'
})
export class VehicleFormComponent implements OnInit {
  vehicleForm: FormGroup;
  loading = false;
  isEditMode = false;
  vehicleId: string | null = null;

  fuelTypes = ['GASOLINA', 'ETANOL', 'DIESEL', 'FLEX', 'GNV', 'ELETRICO'];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.vehicleForm = this.fb.group({
      plate: ['', Validators.required],
      brand: ['', Validators.required],
      model: ['', Validators.required],
      year: ['', [Validators.required, Validators.min(1900), Validators.max(new Date().getFullYear() + 1)]],
      color: [''],
      chassisNumber: [''],
      renavam: [''],
      currentKm: [0, [Validators.required, Validators.min(0)]],
      fuelType: ['FLEX', Validators.required]
    });
  }

  ngOnInit() {
    this.vehicleId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.vehicleId;

    if (this.isEditMode && this.vehicleId) {
      this.loadVehicle(this.vehicleId);
    }
  }

  loadVehicle(id: string) {
    this.apiService.get(`/vehicles/${id}`).subscribe({
      next: (vehicle: any) => {
        this.vehicleForm.patchValue(vehicle);
      },
      error: (error) => {
        console.error('Error loading vehicle:', error);
      }
    });
  }

  onSubmit() {
    if (this.vehicleForm.valid && !this.loading) {
      this.loading = true;

      const request = this.isEditMode && this.vehicleId
        ? this.apiService.put(`/vehicles/${this.vehicleId}`, this.vehicleForm.value)
        : this.apiService.post('/vehicles', this.vehicleForm.value);

      request.subscribe({
        next: () => {
          this.router.navigate(['/vehicles']);
        },
        error: (error) => {
          console.error('Error saving vehicle:', error);
          this.loading = false;
        }
      });
    }
  }
}
EOF

cat > src/app/features/vehicles/pages/vehicle-form/vehicle-form.component.html << 'EOF'
<div class="max-w-2xl mx-auto space-y-6">
  <div>
    <h1 class="text-3xl font-bold">{{ isEditMode ? 'Editar' : 'Novo' }} Veículo</h1>
    <p class="text-muted-foreground">Preencha os dados do veículo</p>
  </div>

  <app-card>
    <app-card-content>
      <form [formGroup]="vehicleForm" (ngSubmit)="onSubmit()">
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <label class="block text-sm font-medium mb-2">Placa *</label>
            <input type="text" formControlName="plate" class="w-full px-3 py-2 border border-input rounded-md bg-background" placeholder="ABC-1234" />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Marca *</label>
            <input type="text" formControlName="brand" class="w-full px-3 py-2 border border-input rounded-md bg-background" placeholder="Volkswagen" />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Modelo *</label>
            <input type="text" formControlName="model" class="w-full px-3 py-2 border border-input rounded-md bg-background" placeholder="Gol" />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Ano *</label>
            <input type="number" formControlName="year" class="w-full px-3 py-2 border border-input rounded-md bg-background" placeholder="2024" />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Cor</label>
            <input type="text" formControlName="color" class="w-full px-3 py-2 border border-input rounded-md bg-background" placeholder="Branco" />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Tipo de Combustível *</label>
            <select formControlName="fuelType" class="w-full px-3 py-2 border border-input rounded-md bg-background">
              <option *ngFor="let fuel of fuelTypes" [value]="fuel">{{ fuel }}</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">KM Atual *</label>
            <input type="number" formControlName="currentKm" class="w-full px-3 py-2 border border-input rounded-md bg-background" placeholder="0" />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Chassi</label>
            <input type="text" formControlName="chassisNumber" class="w-full px-3 py-2 border border-input rounded-md bg-background" />
          </div>

          <div>
            <label class="block text-sm font-medium mb-2">Renavam</label>
            <input type="text" formControlName="renavam" class="w-full px-3 py-2 border border-input rounded-md bg-background" />
          </div>
        </div>

        <div class="flex gap-3 mt-6">
          <app-button type="submit" variant="default" [disabled]="vehicleForm.invalid" [loading]="loading">
            {{ loading ? 'Salvando...' : 'Salvar' }}
          </app-button>
          <app-button type="button" variant="outline" (clicked)="router.navigate(['/vehicles'])">
            Cancelar
          </app-button>
        </div>
      </form>
    </app-card-content>
  </app-card>
</div>
EOF

echo "✅ Estrutura de componentes criada com sucesso!"
echo ""
echo "Próximo passo: Criar os shared components"
