import { NgModule } from '@angular/core';
import type { Routes } from '@angular/router';
import { RouterModule } from '@angular/router';
import { OnboardingPage } from './pages/onboarding-page/onboarding-page';

const routes: Routes = [
  {
    path: '',
    component: OnboardingPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OnboardingRoutingModule {}
