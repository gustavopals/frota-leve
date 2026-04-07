import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  PoButtonModule,
  PoDialogModule,
  PoDividerModule,
  PoFieldModule,
  PoInfoModule,
  PoMenuModule,
  PoModalModule,
  PoNotificationModule,
  PoPageModule,
  PoTableModule,
  PoTabsModule,
  PoTagModule,
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
    PoDialogModule,
    PoDividerModule,
    PoFieldModule,
    PoInfoModule,
    PoMenuModule,
    PoModalModule,
    PoNotificationModule,
    PoPageModule,
    PoTableModule,
    PoTabsModule,
    PoTagModule,
    PoToolbarModule,
    PoWidgetModule,
  ],
  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    PoButtonModule,
    PoDialogModule,
    PoDividerModule,
    PoFieldModule,
    PoInfoModule,
    PoMenuModule,
    PoModalModule,
    PoNotificationModule,
    PoPageModule,
    PoTableModule,
    PoTabsModule,
    PoTagModule,
    PoToolbarModule,
    PoWidgetModule,
    FeaturePlaceholder,
  ],
})
export class SharedModule {}
