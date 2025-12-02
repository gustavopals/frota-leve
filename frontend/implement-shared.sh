#!/bin/bash

# BUTTON COMPONENT
cat > src/app/shared/components/button/button.ts << 'EOF'
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-button',
  imports: [CommonModule],
  templateUrl: './button.html',
  styleUrls: ['./button.scss']
})
export class ButtonComponent {
  @Input() variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' = 'default';
  @Input() size: 'default' | 'sm' | 'lg' | 'icon' = 'default';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
  @Input() loading = false;
  @Output() clicked = new EventEmitter<Event>();

  get buttonClass(): string {
    const base = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';
    
    const variants = {
      default: 'bg-primary text-primary-foreground hover:bg-primary/90',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      ghost: 'hover:bg-accent hover:text-accent-foreground',
      link: 'text-primary underline-offset-4 hover:underline',
    };

    const sizes = {
      default: 'h-10 px-4 py-2',
      sm: 'h-9 px-3 text-sm',
      lg: 'h-11 px-8',
      icon: 'h-10 w-10',
    };

    return `${base} ${variants[this.variant]} ${sizes[this.size]}`;
  }

  handleClick(event: Event) {
    if (!this.disabled && !this.loading) {
      this.clicked.emit(event);
    }
  }
}
EOF

cat > src/app/shared/components/button/button.html << 'EOF'
<button
  [type]="type"
  [disabled]="disabled || loading"
  [class]="buttonClass"
  (click)="handleClick($event)"
>
  <span *ngIf="loading" class="mr-2 animate-spin">⏳</span>
  <ng-content></ng-content>
</button>
EOF

# CARD COMPONENTS
cat > src/app/shared/components/card/card.ts << 'EOF'
import { Component } from '@angular/core';

@Component({
  selector: 'app-card',
  template: '<div class="rounded-lg border bg-card text-card-foreground shadow-sm"><ng-content></ng-content></div>'
})
export class CardComponent {}

@Component({
  selector: 'app-card-header',
  template: '<div class="flex flex-col space-y-1.5 p-6"><ng-content></ng-content></div>'
})
export class CardHeaderComponent {}

@Component({
  selector: 'app-card-title',
  template: '<h3 class="text-2xl font-semibold leading-none tracking-tight"><ng-content></ng-content></h3>'
})
export class CardTitleComponent {}

@Component({
  selector: 'app-card-description',
  template: '<p class="text-sm text-muted-foreground"><ng-content></ng-content></p>'
})
export class CardDescriptionComponent {}

@Component({
  selector: 'app-card-content',
  template: '<div class="p-6 pt-0"><ng-content></ng-content></div>'
})
export class CardContentComponent {}

@Component({
  selector: 'app-card-footer',
  template: '<div class="flex items-center p-6 pt-0"><ng-content></ng-content></div>'
})
export class CardFooterComponent {}
EOF

# THEME TOGGLE
cat > src/app/shared/components/theme-toggle/theme-toggle.ts << 'EOF'
import { Component } from '@angular/core';
import { ThemeService } from '../../../core/services/theme';

@Component({
  selector: 'app-theme-toggle',
  templateUrl: './theme-toggle.html',
  styleUrls: ['./theme-toggle.scss']
})
export class ThemeToggleComponent {
  isDarkMode = this.themeService.isDarkMode;

  constructor(private themeService: ThemeService) {}

  toggleTheme() {
    this.themeService.toggleTheme();
  }
}
EOF

cat > src/app/shared/components/theme-toggle/theme-toggle.html << 'EOF'
<button
  (click)="toggleTheme()"
  class="p-2 rounded-md hover:bg-accent transition-colors"
  [attr.aria-label]="isDarkMode() ? 'Mudar para tema claro' : 'Mudar para tema escuro'"
>
  <span class="text-xl">{{ isDarkMode() ? '🌞' : '🌙' }}</span>
</button>
EOF

# STAT CARD
cat > src/app/shared/components/stat-card/stat-card.ts << 'EOF'
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
EOF

cat > src/app/shared/components/stat-card/stat-card.html << 'EOF'
<app-card>
  <app-card-content class="pt-6">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm font-medium text-muted-foreground">{{ title }}</p>
        <p class="text-2xl font-bold mt-2">{{ value }}</p>
      </div>
      <div class="text-4xl">{{ icon }}</div>
    </div>
  </app-card-content>
</app-card>
EOF

# NAVBAR
cat > src/app/shared/components/navbar/navbar.ts << 'EOF'
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle';

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, RouterLink, ThemeToggleComponent],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.scss']
})
export class NavbarComponent {
  constructor(public authService: AuthService) {}

  get currentUser() {
    return this.authService.currentUser;
  }

  logout() {
    this.authService.logout();
  }
}
EOF

cat > src/app/shared/components/navbar/navbar.html << 'EOF'
<nav class="border-b bg-card">
  <div class="flex h-16 items-center px-4 container mx-auto">
    <a routerLink="/dashboard" class="text-xl font-bold mr-8">Frota Leve</a>
    
    <div class="ml-auto flex items-center space-x-4">
      <app-theme-toggle></app-theme-toggle>
      
      <div class="flex items-center space-x-2">
        <span class="text-sm">{{ currentUser()?.name }}</span>
        <button
          (click)="logout()"
          class="text-sm text-muted-foreground hover:text-foreground"
        >
          Sair
        </button>
      </div>
    </div>
  </div>
</nav>
EOF

# SIDEBAR
cat > src/app/shared/components/sidebar/sidebar.ts << 'EOF'
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss']
})
export class SidebarComponent {
  menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: '📊', route: '/dashboard' },
    { label: 'Veículos', icon: '🚗', route: '/vehicles' },
  ];
}
EOF

cat > src/app/shared/components/sidebar/sidebar.html << 'EOF'
<aside class="w-64 min-h-screen border-r bg-card p-4">
  <nav class="space-y-1">
    <a
      *ngFor="let item of menuItems"
      [routerLink]="item.route"
      routerLinkActive="bg-accent text-accent-foreground font-medium"
      class="flex items-center space-x-3 px-4 py-3 text-sm rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      <span class="text-lg">{{ item.icon }}</span>
      <span>{{ item.label }}</span>
    </a>
  </nav>
</aside>
EOF

echo "✅ Shared components implementados!"
