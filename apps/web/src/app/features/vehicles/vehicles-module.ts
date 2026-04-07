import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared-module';
import { VehiclesRoutingModule } from './vehicles-routing-module';
import { VehiclesPage } from './pages/vehicles-page/vehicles-page';

@NgModule({
  declarations: [VehiclesPage],
  imports: [SharedModule, VehiclesRoutingModule],
})
export class VehiclesModule {}
