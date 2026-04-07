import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  PoButtonModule,
  PoFieldModule,
  PoMenuModule,
  PoNotificationModule,
  PoPageModule,
  PoToolbarModule,
  PoWidgetModule,
} from '@po-ui/ng-components';
import { FeaturePlaceholder } from './components/feature-placeholder/feature-placeholder';

@NgModule({
  declarations: [FeaturePlaceholder],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    PoButtonModule,
    PoFieldModule,
    PoMenuModule,
    PoNotificationModule,
    PoPageModule,
    PoToolbarModule,
    PoWidgetModule,
  ],
  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    PoButtonModule,
    PoFieldModule,
    PoMenuModule,
    PoNotificationModule,
    PoPageModule,
    PoToolbarModule,
    PoWidgetModule,
    FeaturePlaceholder,
  ],
})
export class SharedModule {}
