import { Component } from '@angular/core';
import { ThemeService } from '../../../core/services/theme';

@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.html',
  styleUrls: ['./theme-toggle.scss']
})
export class ThemeToggleComponent {
  isDarkMode;

  constructor(private themeService: ThemeService) {
    this.isDarkMode = this.themeService.isDarkMode;
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }
}
