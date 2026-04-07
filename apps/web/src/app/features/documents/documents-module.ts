import { NgModule } from '@angular/core';
import { SharedModule } from '../../shared/shared-module';
import { DocumentsRoutingModule } from './documents-routing-module';
import { DocumentsPage } from './pages/documents-page/documents-page';

@NgModule({
  declarations: [DocumentsPage],
  imports: [SharedModule, DocumentsRoutingModule],
})
export class DocumentsModule {}
