import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared-module';
import { FinesRoutingModule } from './fines-routing-module';
import { FinesPage } from './pages/fines-page/fines-page';

@NgModule({
  declarations: [FinesPage],
  imports: [SharedModule, FinesRoutingModule],
})
export class FinesModule {}
