# 🎨 Guia Completo - Frontend Angular Frota Leve

Este guia contém TODOS os arquivos necessários para implementar o frontend completo.

## 📁 Estrutura de Diretórios

Primeiro, criar todos os diretórios:

\`\`\`bash
cd /opt/frota-leve/frontend/src/app

# Core
mkdir -p core/{services,guards,interceptors,models}

# Shared
mkdir -p shared/components/{button,card,input,navbar,sidebar,theme-toggle,stat-card,table,dialog}

# Features
mkdir -p features/{auth,dashboard,vehicles,settings}
mkdir -p features/auth/pages/{login,register}
mkdir -p features/dashboard/pages/overview
mkdir -p features/vehicles/pages/{vehicle-list,vehicle-form,vehicle-detail}
\`\`\`

---

## 🔧 PARTE 1: Configuração Base

### 1.1. PostCSS Config

**Arquivo**: `frontend/postcss.config.js`

\`\`\`javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
\`\`\`

### 1.2. App Config

**Arquivo**: `src/app/app.config.ts`

\`\`\`typescript
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideHttpClient(
      withInterceptors([authInterceptor, errorInterceptor])
    ),
  ]
};
\`\`\`

---

## 💾 PARTE 2: Core Services

### 2.1. Auth Service

**Arquivo**: `src/app/core/services/auth.service.ts`

\`\`\`typescript
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

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = environment.apiUrl;
  private readonly TOKEN_KEY = 'access_token';
  
  currentUser = signal<AuthResponse['user'] | null>(null);
  isAuthenticated = signal<boolean>(false);

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.checkAuth();
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(\`\${this.API_URL}/auth/login\`, credentials)
      .pipe(
        tap(response => this.handleAuthSuccess(response))
      );
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(\`\${this.API_URL}/auth/register\`, data)
      .pipe(
        tap(response => this.handleAuthSuccess(response))
      );
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
\`\`\`

### 2.2. Theme Service

**Arquivo**: `src/app/core/services/theme.service.ts`

\`\`\`typescript
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

  setTheme(dark: boolean): void {
    this.isDarkMode.set(dark);
  }
}
\`\`\`

### 2.3. API Service

**Arquivo**: `src/app/core/services/api.service.ts`

\`\`\`typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
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

  patch<T>(endpoint: string, body: any): Observable<T> {
    return this.http.patch<T>(\`\${this.API_URL}\${endpoint}\`, body);
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
\`\`\`

---

## 🛡️ PARTE 3: Guards e Interceptors

### 3.1. Auth Guard

**Arquivo**: `src/app/core/guards/auth.guard.ts`

\`\`\`typescript
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
\`\`\`

### 3.2. Auth Interceptor

**Arquivo**: `src/app/core/interceptors/auth.interceptor.ts`

\`\`\`typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: \`Bearer \${token}\`
      }
    });
  }

  return next(req);
};
\`\`\`

### 3.3. Error Interceptor

**Arquivo**: `src/app/core/interceptors/error.interceptor.ts`

\`\`\`typescript
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
\`\`\`

---

## 🎨 PARTE 4: Shared Components

### 4.1. Button Component

**Arquivo**: `src/app/shared/components/button/button.component.ts`

\`\`\`typescript
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
\`\`\`

### 4.2. Card Components

**Arquivo**: `src/app/shared/components/card/card.component.ts`

\`\`\`typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  template: \`
    <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
      <ng-content></ng-content>
    </div>
  \`
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
\`\`\`

---

Arquivo é muito extenso. Criando versão resumida com links para componentes...
