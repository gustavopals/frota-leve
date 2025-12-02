import { Component, Input } from '@angular/core';
import { CardComponent, CardContentComponent } from '../card/card';

@Component({
  selector: 'app-stat-card',
  imports: [CardComponent, CardContentComponent],
  templateUrl: './stat-card.html',
  styleUrls: ['./stat-card.scss']
})
export class StatCardComponent {
  @Input() title: string = '';
  @Input() value: string = '';
  @Input() icon: string = '';
}
