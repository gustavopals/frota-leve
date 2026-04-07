import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared-module';
import { IncidentsRoutingModule } from './incidents-routing-module';
import { IncidentsPage } from './pages/incidents-page/incidents-page';

@NgModule({
  declarations: [IncidentsPage],
  imports: [SharedModule, IncidentsRoutingModule],
})
export class IncidentsModule {}
