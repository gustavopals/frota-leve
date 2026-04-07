import { NgModule } from '@angular/core';
import { LayoutModule } from '../../layout/layout-module';
import { SharedModule } from '../../shared/shared-module';
import { AuthRoutingModule } from './auth-routing-module';
import { ForgotPasswordPage } from './pages/forgot-password-page/forgot-password-page';
import { LoginPage } from './pages/login-page/login-page';
import { RegisterPage } from './pages/register-page/register-page';
import { ResetPasswordPage } from './pages/reset-password-page/reset-password-page';

@NgModule({
  declarations: [LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage],
  imports: [SharedModule, LayoutModule, AuthRoutingModule],
})
export class AuthModule {}
