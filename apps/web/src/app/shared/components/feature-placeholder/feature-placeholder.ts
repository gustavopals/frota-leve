import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-feature-placeholder',
  standalone: false,
  templateUrl: './feature-placeholder.html',
  styleUrl: './feature-placeholder.scss',
})
export class FeaturePlaceholder {
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
  @Input() description = '';
  @Input() eyebrow = 'Setup base';
}
