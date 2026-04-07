import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared-module';
import { DriversRoutingModule } from './drivers-routing-module';
import { DriversPage } from './pages/drivers-page/drivers-page';

@NgModule({
  declarations: [DriversPage],
  imports: [SharedModule, DriversRoutingModule],
})
export class DriversModule {}
