import { Component, input } from '@angular/core';
import { PoPageModule, PoWidgetModule } from '@po-ui/ng-components';

@Component({
  selector: 'app-feature-placeholder',
  imports: [PoPageModule, PoWidgetModule],
  templateUrl: './feature-placeholder.html',
  styleUrl: './feature-placeholder.scss',
})
export class FeaturePlaceholder {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly description = input('');
  readonly eyebrow = input('Setup base');
}
