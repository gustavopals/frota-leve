#!/bin/bash

# Script para criar shared components
cd /opt/frota-leve/frontend

echo "🎨 Criando shared components..."

# ===============================
# NAVBAR
# ===============================
echo "📱 Criando Navbar..."

cat > src/app/shared/components/navbar/navbar.component.ts << 'EOF'
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, ThemeToggleComponent],
  templateUrl: './navbar.component.html'
})
export class NavbarComponent {
  currentUser = this.authService.currentUser;

  constructor(public authService: AuthService) {}

  logout() {
    this.authService.logout();
  }
}
EOF

cat > src/app/shared/components/navbar/navbar.component.html << 'EOF'
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

# ===============================
# SIDEBAR
# ===============================
echo "📂 Criando Sidebar..."

cat > src/app/shared/components/sidebar/sidebar.component.ts << 'EOF'
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  roles?: string[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styles: [`
    .nav-link {
      @apply flex items-center space-x-3 px-4 py-3 text-sm rounded-lg transition-colors;
      @apply hover:bg-accent hover:text-accent-foreground;
    }
    .nav-link.active {
      @apply bg-accent text-accent-foreground font-medium;
    }
  `]
})
export class SidebarComponent {
  menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: '📊', route: '/dashboard' },
    { label: 'Veículos', icon: '🚗', route: '/vehicles' },
    { label: 'Manutenções', icon: '🔧', route: '/maintenance' },
    { label: 'Abastecimentos', icon: '⛽', route: '/fuel' },
    { label: 'Checklists', icon: '✅', route: '/checklists' },
    { label: 'Motoristas', icon: '👤', route: '/drivers' },
    { label: 'Relatórios', icon: '📈', route: '/reports' },
    { label: 'Configurações', icon: '⚙️', route: '/settings' },
  ];
}
EOF

cat > src/app/shared/components/sidebar/sidebar.component.html << 'EOF'
<aside class="w-64 min-h-screen border-r bg-card p-4">
  <nav class="space-y-1">
    <a
      *ngFor="let item of menuItems"
      [routerLink]="item.route"
      routerLinkActive="active"
      class="nav-link"
    >
      <span class="text-lg">{{ item.icon }}</span>
      <span>{{ item.label }}</span>
    </a>
  </nav>
</aside>
EOF

# ===============================
# THEME TOGGLE
# ===============================
echo "🌓 Criando Theme Toggle..."

cat > src/app/shared/components/theme-toggle/theme-toggle.component.ts << 'EOF'
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      (click)="toggleTheme()"
      class="p-2 rounded-md hover:bg-accent transition-colors"
      [attr.aria-label]="isDarkMode() ? 'Mudar para tema claro' : 'Mudar para tema escuro'"
    >
      <span class="text-xl">{{ isDarkMode() ? '🌞' : '🌙' }}</span>
    </button>
  `
})
export class ThemeToggleComponent {
  isDarkMode = this.themeService.isDarkMode;

  constructor(private themeService: ThemeService) {}

  toggleTheme() {
    this.themeService.toggleTheme();
  }
}
EOF

# ===============================
# STAT CARD
# ===============================
echo "📊 Criando Stat Card..."

cat > src/app/shared/components/stat-card/stat-card.component.ts << 'EOF'
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, CardHeaderComponent, CardTitleComponent, CardContentComponent } from '../card/card.component';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule, CardComponent, CardHeaderComponent, CardTitleComponent, CardContentComponent],
  template: `
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
  `
})
export class StatCardComponent {
  @Input() title: string = '';
  @Input() value: string = '';
  @Input() icon: string = '';
}
EOF

# ===============================
# APP COMPONENT
# ===============================
echo "🎯 Atualizando App Component..."

cat > src/app/app.component.ts << 'EOF'
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>'
})
export class AppComponent {
  title = 'Frota Leve';
}
EOF

# ===============================
# INDEX HTML
# ===============================
echo "📄 Atualizando index.html..."

cat > src/index.html << 'EOF'
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Frota Leve - Gestão de Frotas</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body class="font-sans antialiased">
  <app-root></app-root>
</body>
</html>
EOF

# ===============================
# ANGULAR JSON
# ===============================
echo "⚙️  Atualizando angular.json..."

# Adicionar Tailwind ao build
cat > temp-angular-update.js << 'EOF'
const fs = require('fs');
const path = './angular.json';
const config = JSON.parse(fs.readFileSync(path, 'utf8'));

// Ensure styles include tailwind
const buildOptions = config.projects.frontend.architect.build.options;
if (!buildOptions.styles.includes('src/styles.scss')) {
  buildOptions.styles = ['src/styles.scss'];
}

fs.writeFileSync(path, JSON.stringify(config, null, 2));
console.log('✅ angular.json updated');
EOF

node temp-angular-update.js
rm temp-angular-update.js

echo ""
echo "✅ Todos os shared components criados!"
echo ""
echo "📝 Próximos passos:"
echo "1. Execute: bash create-components.sh"
echo "2. Execute: bash create-shared-components.sh"
echo "3. Inicie o servidor: npm start"
