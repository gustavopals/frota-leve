import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared-module';
import { MaintenanceRoutingModule } from './maintenance-routing-module';
import { MaintenancePage } from './pages/maintenance-page/maintenance-page';

@NgModule({
  declarations: [MaintenancePage],
  imports: [SharedModule, MaintenanceRoutingModule],
})
export class MaintenanceModule {}
