import { NgModule } from '@angular/core';
import type { Routes } from '@angular/router';
import { RouterModule } from '@angular/router';
import { AiAssistantPage } from './pages/ai-assistant-page/ai-assistant-page';

const routes: Routes = [{ path: '', component: AiAssistantPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AiAssistantRoutingModule {}
