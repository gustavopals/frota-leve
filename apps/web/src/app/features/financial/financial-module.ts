import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared-module';
import { FinancialRoutingModule } from './financial-routing-module';
import { FinancialPage } from './pages/financial-page/financial-page';

@NgModule({
  declarations: [FinancialPage],
  imports: [SharedModule, FinancialRoutingModule],
})
export class FinancialModule {}
