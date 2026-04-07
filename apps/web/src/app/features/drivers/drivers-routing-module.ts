import { NgModule } from '@angular/core';
import type { Routes } from '@angular/router';
import { RouterModule } from '@angular/router';
import { DriversPage } from './pages/drivers-page/drivers-page';

const routes: Routes = [{ path: '', component: DriversPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DriversRoutingModule {}
