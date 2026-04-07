import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PoThemeService } from '@po-ui/ng-components';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly poThemeService = inject(PoThemeService);
  protected readonly title = signal('Frota Leve');

  constructor() {
    this.poThemeService.setDensityMode('small');
  }
}
