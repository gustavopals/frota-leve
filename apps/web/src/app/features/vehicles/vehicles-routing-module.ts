import { NgModule } from '@angular/core';
import type { Routes } from '@angular/router';
import { RouterModule } from '@angular/router';
import { VehicleDetailPage } from './pages/vehicle-detail-page/vehicle-detail-page';
import { VehicleFormPage } from './pages/vehicle-form-page/vehicle-form-page';
import { VehiclesPage } from './pages/vehicles-page/vehicles-page';

const routes: Routes = [
  { path: '', component: VehiclesPage },
  { path: 'new', component: VehicleFormPage },
  { path: ':id/edit', component: VehicleFormPage },
  { path: ':id', component: VehicleDetailPage },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VehiclesRoutingModule {}
