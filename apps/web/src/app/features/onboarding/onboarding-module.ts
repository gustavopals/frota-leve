import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared-module';
import { OnboardingRoutingModule } from './onboarding-routing-module';
import { OnboardingPage } from './pages/onboarding-page/onboarding-page';

@NgModule({
  declarations: [OnboardingPage],
  imports: [SharedModule, OnboardingRoutingModule],
})
export class OnboardingModule {}
