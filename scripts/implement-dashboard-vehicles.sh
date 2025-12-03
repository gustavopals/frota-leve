#!/bin/bash

# DASHBOARD ROUTES
cat > src/app/features/dashboard/dashboard.routes.ts << 'EOF'
import { Routes } from '@angular/router';
import { DashboardLayoutComponent } from './dashboard-layout/dashboard-layout';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    component: DashboardLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/overview/overview').then(m => m.OverviewComponent)
      }
    ]
  }
];
EOF

# DASHBOARD LAYOUT
cat > src/app/features/dashboard/dashboard-layout/dashboard-layout.ts << 'EOF'
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../../../shared/components/navbar/navbar';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-dashboard-layout',
  imports: [CommonModule, RouterOutlet, NavbarComponent, SidebarComponent],
  templateUrl: './dashboard-layout.html',
  styleUrls: ['./dashboard-layout.scss']
})
export class DashboardLayoutComponent {}
EOF

cat > src/app/features/dashboard/dashboard-layout/dashboard-layout.html << 'EOF'
<div class="min-h-screen bg-background">
  <app-navbar></app-navbar>
  <div class="flex">
    <app-sidebar class="hidden lg:block"></app-sidebar>
    <main class="flex-1 p-6">
      <router-outlet></router-outlet>
    </main>
  </div>
</div>
EOF

# DASHBOARD OVERVIEW
cat > src/app/features/dashboard/pages/overview/overview.ts << 'EOF'
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, CardHeaderComponent, CardTitleComponent, CardContentComponent } from '../../../../shared/components/card/card';
import { StatCardComponent } from '../../../../shared/components/stat-card/stat-card';

@Component({
  selector: 'app-overview',
  imports: [
    CommonModule,
    CardComponent,
    CardHeaderComponent,
    CardTitleComponent,
    CardContentComponent,
    StatCardComponent
  ],
  templateUrl: './overview.html',
  styleUrls: ['./overview.scss']
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

cat > src/app/features/dashboard/pages/overview/overview.html << 'EOF'
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

# VEHICLES ROUTES
cat > src/app/features/vehicles/vehicles.routes.ts << 'EOF'
import { Routes } from '@angular/router';

export const VEHICLES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/vehicle-list/vehicle-list').then(m => m.VehicleListComponent)
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/vehicle-form/vehicle-form').then(m => m.VehicleFormComponent)
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./pages/vehicle-form/vehicle-form').then(m => m.VehicleFormComponent)
  }
];
EOF

# VEHICLE LIST
cat > src/app/features/vehicles/pages/vehicle-list/vehicle-list.ts << 'EOF'
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../../../core/services/api';
import { Vehicle } from '../../../../core/models/vehicle.model';
import { NavbarComponent } from '../../../../shared/components/navbar/navbar';
import { SidebarComponent } from '../../../../shared/components/sidebar/sidebar';
import { CardComponent, CardContentComponent } from '../../../../shared/components/card/card';

@Component({
  selector: 'app-vehicle-list',
  imports: [
    CommonModule,
    RouterLink,
    NavbarComponent,
    SidebarComponent,
    CardComponent,
    CardContentComponent
  ],
  templateUrl: './vehicle-list.html',
  styleUrls: ['./vehicle-list.scss']
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

cat > src/app/features/vehicles/pages/vehicle-list/vehicle-list.html << 'EOF'
<div class="min-h-screen bg-background">
  <app-navbar></app-navbar>
  <div class="flex">
    <app-sidebar class="hidden lg:block"></app-sidebar>
    <main class="flex-1 p-6">
      <div class="space-y-6">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-bold">Veículos</h1>
            <p class="text-muted-foreground">Gerencie sua frota</p>
          </div>
          <a routerLink="/vehicles/new">
            <button class="inline-flex items-center justify-center rounded-md font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
              + Novo Veículo
            </button>
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
                <button class="inline-flex items-center justify-center rounded-md font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                  Cadastrar Primeiro Veículo
                </button>
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
    </main>
  </div>
</div>
EOF

# VEHICLE FORM
cat > src/app/features/vehicles/pages/vehicle-form/vehicle-form.ts << 'EOF'
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../../core/services/api';
import { NavbarComponent } from '../../../../shared/components/navbar/navbar';
import { SidebarComponent } from '../../../../shared/components/sidebar/sidebar';
import { CardComponent, CardContentComponent } from '../../../../shared/components/card/card';

@Component({
  selector: 'app-vehicle-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NavbarComponent,
    SidebarComponent,
    CardComponent,
    CardContentComponent
  ],
  templateUrl: './vehicle-form.html',
  styleUrls: ['./vehicle-form.scss']
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
    public router: Router,
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

cat > src/app/features/vehicles/pages/vehicle-form/vehicle-form.html << 'EOF'
<div class="min-h-screen bg-background">
  <app-navbar></app-navbar>
  <div class="flex">
    <app-sidebar class="hidden lg:block"></app-sidebar>
    <main class="flex-1 p-6">
      <div class="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 class="text-3xl font-bold">{{ isEditMode ? 'Editar' : 'Novo' }} Veículo</h1>
          <p class="text-muted-foreground">Preencha os dados do veículo</p>
        </div>

        <app-card>
          <app-card-content>
            <form [formGroup]="vehicleForm" (ngSubmit)="onSubmit()">
              <div class="grid gap-4 md:grid-cols-2 mt-6">
                <div>
                  <label class="block text-sm font-medium mb-2">Placa *</label>
                  <input type="text" formControlName="plate" class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="ABC-1234" />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Marca *</label>
                  <input type="text" formControlName="brand" class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Volkswagen" />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Modelo *</label>
                  <input type="text" formControlName="model" class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Gol" />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Ano *</label>
                  <input type="number" formControlName="year" class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="2024" />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Cor</label>
                  <input type="text" formControlName="color" class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Branco" />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Tipo de Combustível *</label>
                  <select formControlName="fuelType" class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                    <option *ngFor="let fuel of fuelTypes" [value]="fuel">{{ fuel }}</option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">KM Atual *</label>
                  <input type="number" formControlName="currentKm" class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" placeholder="0" />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Chassi</label>
                  <input type="text" formControlName="chassisNumber" class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Renavam</label>
                  <input type="text" formControlName="renavam" class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>

              <div class="flex gap-3 mt-6">
                <button
                  type="submit"
                  [disabled]="vehicleForm.invalid || loading"
                  class="inline-flex items-center justify-center rounded-md font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 disabled:opacity-50"
                >
                  {{ loading ? 'Salvando...' : 'Salvar' }}
                </button>
                <button
                  type="button"
                  (click)="router.navigate(['/vehicles'])"
                  class="inline-flex items-center justify-center rounded-md font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </app-card-content>
        </app-card>
      </div>
    </main>
  </div>
</div>
EOF

echo "✅ Dashboard e Vehicles implementados!"
