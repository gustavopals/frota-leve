import { NgModule } from '@angular/core';
import type { Routes } from '@angular/router';
import { RouterModule } from '@angular/router';
import { AuthGuard } from './core/guards/auth-guard';
import { RoleGuard } from './core/guards/role-guard';
import { MainLayout } from './layout/main-layout/main-layout';

const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth-module').then((module) => module.AuthModule),
  },
  {
    path: '',
    component: MainLayout,
    canActivateChild: [AuthGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () =>
          import('./features/dashboard/dashboard-module').then((module) => module.DashboardModule),
      },
      {
        path: 'vehicles',
        loadChildren: () =>
          import('./features/vehicles/vehicles-module').then((module) => module.VehiclesModule),
      },
      {
        path: 'drivers',
        loadChildren: () =>
          import('./features/drivers/drivers-module').then((module) => module.DriversModule),
      },
      {
        path: 'fuel',
        loadChildren: () =>
          import('./features/fuel/fuel-module').then((module) => module.FuelModule),
      },
      {
        path: 'maintenance',
        loadChildren: () =>
          import('./features/maintenance/maintenance-module').then(
            (module) => module.MaintenanceModule,
          ),
      },
      {
        path: 'tires',
        loadChildren: () =>
          import('./features/tires/tires-module').then((module) => module.TiresModule),
      },
      {
        path: 'fines',
        loadChildren: () =>
          import('./features/fines/fines-module').then((module) => module.FinesModule),
      },
      {
        path: 'documents',
        loadChildren: () =>
          import('./features/documents/documents-module').then((module) => module.DocumentsModule),
      },
      {
        path: 'incidents',
        loadChildren: () =>
          import('./features/incidents/incidents-module').then((module) => module.IncidentsModule),
      },
      {
        path: 'financial',
        canActivate: [RoleGuard],
        data: {
          roles: ['OWNER', 'ADMIN', 'FINANCIAL'],
        },
        loadChildren: () =>
          import('./features/financial/financial-module').then((module) => module.FinancialModule),
      },
      {
        path: 'reports',
        loadChildren: () =>
          import('./features/reports/reports-module').then((module) => module.ReportsModule),
      },
      {
        path: 'ai-assistant',
        loadChildren: () =>
          import('./features/ai-assistant/ai-assistant-module').then(
            (module) => module.AiAssistantModule,
          ),
      },
      {
        path: 'settings',
        canActivate: [RoleGuard],
        data: {
          roles: ['OWNER', 'ADMIN'],
        },
        loadChildren: () =>
          import('./features/settings/settings-module').then((module) => module.SettingsModule),
      },
      {
        path: '**',
        redirectTo: 'dashboard',
      },
    ],
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      bindToComponentInputs: true,
      scrollPositionRestoration: 'enabled',
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
