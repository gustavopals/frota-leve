import { Routes } from '@angular/router';
import { MaintenanceListComponent } from './pages/maintenance-list/maintenance-list.component';
import { MaintenanceFormComponent } from './pages/maintenance-form/maintenance-form.component';
import { MaintenancePlansComponent } from './pages/maintenance-plans/maintenance-plans.component';

export const maintenanceRoutes: Routes = [
  {
    path: '',
    component: MaintenanceListComponent
  },
  {
    path: 'new',
    component: MaintenanceFormComponent
  },
  {
    path: 'edit/:id',
    component: MaintenanceFormComponent
  },
  {
    path: 'plans',
    component: MaintenancePlansComponent
  }
];
