import { Injectable, signal, effect } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'theme';
  isDarkMode = signal<boolean>(false);

  constructor() {
    const savedTheme = localStorage.getItem(this.THEME_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.isDarkMode.set(savedTheme === 'dark' || (!savedTheme && prefersDark));

    effect(() => {
      const isDark = this.isDarkMode();
      document.documentElement.classList.toggle('dark', isDark);
      localStorage.setItem(this.THEME_KEY, isDark ? 'dark' : 'light');
    });
  }

  toggleTheme(): void {
    this.isDarkMode.update(dark => !dark);
  }
}
