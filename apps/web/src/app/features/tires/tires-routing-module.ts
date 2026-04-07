import { NgModule } from '@angular/core';
import type { Routes } from '@angular/router';
import { RouterModule } from '@angular/router';
import { TiresPage } from './pages/tires-page/tires-page';

const routes: Routes = [{ path: '', component: TiresPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TiresRoutingModule {}
