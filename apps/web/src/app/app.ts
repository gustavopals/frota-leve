import { Component, inject, signal } from '@angular/core';
import { PoThemeService } from '@po-ui/ng-components';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.scss',
})
export class App {
  private readonly poThemeService = inject(PoThemeService);
  protected readonly title = signal('Frota Leve');

  constructor() {
    this.poThemeService.setDensityMode('small');
  }
}
