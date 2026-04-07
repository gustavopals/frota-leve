import { NgModule } from '@angular/core';
import { LayoutModule } from '../../layout/layout-module';
import { SharedModule } from '../../shared/shared-module';
import { AuthRoutingModule } from './auth-routing-module';
import { LoginPage } from './pages/login-page/login-page';

@NgModule({
  declarations: [LoginPage],
  imports: [SharedModule, LayoutModule, AuthRoutingModule],
})
export class AuthModule {}
