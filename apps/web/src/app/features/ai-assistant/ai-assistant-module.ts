import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared-module';
import { AiAssistantRoutingModule } from './ai-assistant-routing-module';
import { AiAssistantPage } from './pages/ai-assistant-page/ai-assistant-page';

@NgModule({
  declarations: [AiAssistantPage],
  imports: [SharedModule, AiAssistantRoutingModule],
})
export class AiAssistantModule {}
