import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared-module';
import { FuelRoutingModule } from './fuel-routing-module';
import { FuelPage } from './pages/fuel-page/fuel-page';

@NgModule({
  declarations: [FuelPage],
  imports: [SharedModule, FuelRoutingModule],
})
export class FuelModule {}
