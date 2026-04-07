import { NgModule } from '@angular/core';
import type { Routes } from '@angular/router';
import { RouterModule } from '@angular/router';
import { FuelPage } from './pages/fuel-page/fuel-page';

const routes: Routes = [{ path: '', component: FuelPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FuelRoutingModule {}
