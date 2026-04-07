import { NgModule } from '@angular/core';
import type { Routes } from '@angular/router';
import { RouterModule } from '@angular/router';
import { MaintenancePage } from './pages/maintenance-page/maintenance-page';

const routes: Routes = [{ path: '', component: MaintenancePage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MaintenanceRoutingModule {}
