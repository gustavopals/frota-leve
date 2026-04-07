import { NgModule } from '@angular/core';
import { MainLayout } from './main-layout/main-layout';
import { AuthLayout } from './auth-layout/auth-layout';
import { SharedModule } from '../shared/shared-module';

@NgModule({
  declarations: [MainLayout, AuthLayout],
  imports: [SharedModule],
  exports: [MainLayout, AuthLayout],
})
export class LayoutModule {}
