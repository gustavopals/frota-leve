import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared-module';
import { ReportsRoutingModule } from './reports-routing-module';
import { ReportsPage } from './pages/reports-page/reports-page';

@NgModule({
  declarations: [ReportsPage],
  imports: [SharedModule, ReportsRoutingModule],
})
export class ReportsModule {}
