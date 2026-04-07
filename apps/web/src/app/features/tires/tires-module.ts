import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared-module';
import { TiresRoutingModule } from './tires-routing-module';
import { TiresPage } from './pages/tires-page/tires-page';

@NgModule({
  declarations: [TiresPage],
  imports: [SharedModule, TiresRoutingModule],
})
export class TiresModule {}
