#!/bin/bash

# Script COMPLETO para criar TODOS os arquivos do frontend
cd /opt/frota-leve/frontend/src/app

echo "🚀 Criando TODOS os arquivos necessários..."

# ===== CORE SERVICES =====
cat > core/services/auth.service.ts << 'EOFAUTH'
import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  tenantName: string;
  tenantDocument?: string;
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    tenantId: string;
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API_URL = environment.apiUrl;
  private readonly TOKEN_KEY = 'access_token';
  
  currentUser = signal<AuthResponse['user'] | null>(null);
  isAuthenticated = signal<boolean>(false);

  constructor(private http: HttpClient, private router: Router) {
    this.checkAuth();
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(\`\${this.API_URL}/auth/login\`, credentials)
      .pipe(tap(response => this.handleAuthSuccess(response)));
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(\`\${this.API_URL}/auth/register\`, data)
      .pipe(tap(response => this.handleAuthSuccess(response)));
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem('current_user');
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private handleAuthSuccess(response: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, response.access_token);
    localStorage.setItem('current_user', JSON.stringify(response.user));
    this.currentUser.set(response.user);
    this.isAuthenticated.set(true);
    this.router.navigate(['/dashboard']);
  }

  private checkAuth(): void {
    const token = this.getToken();
    const userStr = localStorage.getItem('current_user');
    if (token && userStr) {
      this.currentUser.set(JSON.parse(userStr));
      this.isAuthenticated.set(true);
    }
  }
}
EOFAUTH

cat > core/services/theme.service.ts << 'EOFTHEME'
import { Injectable, signal, effect } from '@angular/core';

@Injectable({ providedIn: 'root' })
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
EOFTHEME

cat > core/services/api.service.ts << 'EOFAPI'
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  get<T>(endpoint: string, params?: any): Observable<T> {
    return this.http.get<T>(\`\${this.API_URL}\${endpoint}\`, {
      params: this.buildParams(params)
    });
  }

  post<T>(endpoint: string, body: any): Observable<T> {
    return this.http.post<T>(\`\${this.API_URL}\${endpoint}\`, body);
  }

  put<T>(endpoint: string, body: any): Observable<T> {
    return this.http.put<T>(\`\${this.API_URL}\${endpoint}\`, body);
  }

  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(\`\${this.API_URL}\${endpoint}\`);
  }

  private buildParams(params?: any): HttpParams {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return httpParams;
  }
}
EOFAPI

# ===== GUARDS =====
cat > core/guards/auth.guard.ts << 'EOFGUARD'
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  router.navigate(['/auth/login']);
  return false;
};
EOFGUARD

# ===== INTERCEPTORS =====
cat > core/interceptors/auth.interceptor.ts << 'EOFINTAUTH'
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (token) {
    req = req.clone({
      setHeaders: { Authorization: \`Bearer \${token}\` }
    });
  }

  return next(req);
};
EOFINTAUTH

cat > core/interceptors/error.interceptor.ts << 'EOFINTERR'
import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((error) => {
      if (error.status === 401) {
        localStorage.clear();
        router.navigate(['/auth/login']);
      }
      console.error('HTTP Error:', error);
      return throwError(() => error);
    })
  );
};
EOFINTERR

# ===== SHARED COMPONENTS =====
cat > shared/components/button/button.component.ts << 'EOFBTN'
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  template: \`
    <button
      [type]="type"
      [disabled]="disabled || loading"
      [class]="buttonClass"
      (click)="handleClick($event)"
    >
      <span *ngIf="loading" class="mr-2 animate-spin">⏳</span>
      <ng-content></ng-content>
    </button>
  \`
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

    return \`\${base} \${variants[this.variant]} \${sizes[this.size]}\`;
  }

  handleClick(event: Event) {
    if (!this.disabled && !this.loading) {
      this.clicked.emit(event);
    }
  }
}
EOFBTN

cat > shared/components/card/card.component.ts << 'EOFCARD'
import { Component } from '@angular/core';

@Component({
  selector: 'app-card',
  standalone: true,
  template: \`<div class="rounded-lg border bg-card text-card-foreground shadow-sm"><ng-content></ng-content></div>\`
})
export class CardComponent {}

@Component({
  selector: 'app-card-header',
  standalone: true,
  template: \`<div class="flex flex-col space-y-1.5 p-6"><ng-content></ng-content></div>\`
})
export class CardHeaderComponent {}

@Component({
  selector: 'app-card-title',
  standalone: true,
  template: \`<h3 class="text-2xl font-semibold leading-none tracking-tight"><ng-content></ng-content></h3>\`
})
export class CardTitleComponent {}

@Component({
  selector: 'app-card-description',
  standalone: true,
  template: \`<p class="text-sm text-muted-foreground"><ng-content></ng-content></p>\`
})
export class CardDescriptionComponent {}

@Component({
  selector: 'app-card-content',
  standalone: true,
  template: \`<div class="p-6 pt-0"><ng-content></ng-content></div>\`
})
export class CardContentComponent {}

@Component({
  selector: 'app-card-footer',
  standalone: true,
  template: \`<div class="flex items-center p-6 pt-0"><ng-content></ng-content></div>\`
})
export class CardFooterComponent {}
EOFCARD

cat > shared/components/navbar/navbar.component.ts << 'EOFNAV'
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, ThemeToggleComponent],
  template: \`
    <nav class="border-b bg-card">
      <div class="flex h-16 items-center px-4 container mx-auto">
        <a routerLink="/dashboard" class="text-xl font-bold mr-8">Frota Leve</a>
        <div class="ml-auto flex items-center space-x-4">
          <app-theme-toggle></app-theme-toggle>
          <div class="flex items-center space-x-2">
            <span class="text-sm">{{ currentUser()?.name }}</span>
            <button (click)="logout()" class="text-sm text-muted-foreground hover:text-foreground">Sair</button>
          </div>
        </div>
      </div>
    </nav>
  \`
})
export class NavbarComponent {
  currentUser = this.authService.currentUser;
  constructor(public authService: AuthService) {}
  logout() { this.authService.logout(); }
}
EOFNAV

cat > shared/components/sidebar/sidebar.component.ts << 'EOFSIDEBAR'
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: \`
    <aside class="w-64 min-h-screen border-r bg-card p-4">
      <nav class="space-y-1">
        <a *ngFor="let item of menuItems" [routerLink]="item.route" routerLinkActive="bg-accent text-accent-foreground" class="flex items-center space-x-3 px-4 py-3 text-sm rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors">
          <span class="text-lg">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </a>
      </nav>
    </aside>
  \`
})
export class SidebarComponent {
  menuItems = [
    { label: 'Dashboard', icon: '📊', route: '/dashboard' },
    { label: 'Veículos', icon: '🚗', route: '/vehicles' },
  ];
}
EOFSIDEBAR

cat > shared/components/theme-toggle/theme-toggle.component.ts << 'EOFTHEMETOGGLE'
import { Component } from '@angular/core';
import { ThemeService } from '../../../core/services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  template: \`
    <button (click)="toggleTheme()" class="p-2 rounded-md hover:bg-accent transition-colors">
      <span class="text-xl">{{ isDarkMode() ? '🌞' : '🌙' }}</span>
    </button>
  \`
})
export class ThemeToggleComponent {
  isDarkMode = this.themeService.isDarkMode;
  constructor(private themeService: ThemeService) {}
  toggleTheme() { this.themeService.toggleTheme(); }
}
EOFTHEMETOGGLE

cat > shared/components/stat-card/stat-card.component.ts << 'EOFSTAT'
import { Component, Input } from '@angular/core';
import { CardComponent, CardContentComponent } from '../card/card.component';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CardComponent, CardContentComponent],
  template: \`
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
  \`
})
export class StatCardComponent {
  @Input() title: string = '';
  @Input() value: string = '';
  @Input() icon: string = '';
}
EOFSTAT

echo "✅ Todos os arquivos criados com sucesso!"
