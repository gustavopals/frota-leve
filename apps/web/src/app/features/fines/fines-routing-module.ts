import { NgModule } from '@angular/core';
import type { Routes } from '@angular/router';
import { RouterModule } from '@angular/router';
import { FinesPage } from './pages/fines-page/fines-page';

const routes: Routes = [{ path: '', component: FinesPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FinesRoutingModule {}
