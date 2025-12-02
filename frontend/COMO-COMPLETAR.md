# 🚀 Frota Leve - Frontend Angular

## ✅ Status Atual

### Backend - 100% Completo
- ✅ NestJS + Prisma + PostgreSQL configurado
- ✅ Docker Compose funcionando
- ✅ Autenticação JWT implementada
- ✅ API REST com 3 módulos (Auth, Users, Tenants)
- ✅ Swagger documentation em /api
- ✅ **Servidor rodando em http://localhost:3000**

### Frontend - Estrutura Criada
- ✅ Angular 18 inicializado
- ✅ Tailwind CSS v3 configurado
- ✅ Angular Material instalado
- ✅ Tema shadcn-style configurado (tailwind.config.js)
- ✅ Rotas definidas (app.routes.ts)
- ✅ Environments criados
- ⚠️  Componentes precisam ser gerados

## 🎯 Próximos Passos - Gerar Componentes com Angular CLI

### 1. Criar Core Services

```bash
cd /opt/frota-leve/frontend

# Auth Service
ng generate service core/services/auth --skip-tests
ng generate service core/services/api --skip-tests
ng generate service core/services/theme --skip-tests

# Guards
ng generate guard core/guards/auth --functional --skip-tests

# Interceptors  
ng generate interceptor core/interceptors/auth --functional --skip-tests
ng generate interceptor core/interceptors/error --functional --skip-tests
```

### 2. Criar Shared Components

```bash
# Components básicos
ng generate component shared/components/button --standalone --skip-tests
ng generate component shared/components/card --standalone --skip-tests
ng generate component shared/components/navbar --standalone --skip-tests
ng generate component shared/components/sidebar --standalone --skip-tests
ng generate component shared/components/theme-toggle --standalone --skip-tests
ng generate component shared/components/stat-card --standalone --skip-tests
```

### 3. Criar Feature Modules

```bash
# Auth Feature
ng generate component features/auth/pages/login --standalone --skip-tests
ng generate component features/auth/pages/register --standalone --skip-tests

# Dashboard Feature
ng generate component features/dashboard/dashboard-layout --standalone --skip-tests
ng generate component features/dashboard/pages/overview --standalone --skip-tests

# Vehicles Feature
ng generate component features/vehicles/pages/vehicle-list --standalone --skip-tests
ng generate component features/vehicles/pages/vehicle-form --standalone --skip-tests
```

## 📝 Código para Copiar nos Arquivos Gerados

Após gerar os componentes com Angular CLI, copie os códigos abaixo:

### Auth Service (`src/app/core/services/auth.service.ts`)

```typescript
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
    return this.http.post<AuthResponse>(`${this.API_URL}/auth/login`, credentials)
      .pipe(tap(response => this.handleAuthSuccess(response)));
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/auth/register`, data)
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
```

### API Service (`src/app/core/services/api.service.ts`)

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  get<T>(endpoint: string, params?: any): Observable<T> {
    return this.http.get<T>(`${this.API_URL}${endpoint}`, {
      params: this.buildParams(params)
    });
  }

  post<T>(endpoint: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.API_URL}${endpoint}`, body);
  }

  put<T>(endpoint: string, body: any): Observable<T> {
    return this.http.put<T>(`${this.API_URL}${endpoint}`, body);
  }

  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.API_URL}${endpoint}`);
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
```

### Theme Service (`src/app/core/services/theme.service.ts`)

```typescript
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
```

### Auth Guard (`src/app/core/guards/auth.guard.ts`)

```typescript
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
```

### Auth Interceptor (`src/app/core/interceptors/auth.interceptor.ts`)

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(req);
};
```

### Error Interceptor (`src/app/core/interceptors/error.interceptor.ts`)

```typescript
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
```

## 🎨 Template Completo para Login Component

Depois de `ng g component features/auth/pages/login --standalone`:

**login.component.ts:**
```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid && !this.loading) {
      this.loading = true;
      this.errorMessage = '';

      this.authService.login(this.loginForm.value).subscribe({
        next: () => {
          this.router.navigate(['/dashboard']);
        },
        error: (error: any) => {
          this.errorMessage = error.error?.message || 'Erro ao fazer login';
          this.loading = false;
        },
        complete: () => {
          this.loading = false;
        }
      });
    }
  }
}
```

**login.component.html:**
```html
<div class="min-h-screen flex items-center justify-center bg-background p-4">
  <div class="w-full max-w-md">
    <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
      <!-- Header -->
      <div class="flex flex-col space-y-1.5 p-6 text-center">
        <h3 class="text-2xl font-semibold">Bem-vindo ao Frota Leve</h3>
        <p class="text-sm text-muted-foreground">Faça login para acessar sua conta</p>
      </div>
      
      <!-- Content -->
      <div class="p-6 pt-0">
        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
          <div class="space-y-4">
            <!-- Email -->
            <div>
              <label for="email" class="block text-sm font-medium mb-2">Email</label>
              <input
                id="email"
                type="email"
                formControlName="email"
                class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="seu@email.com"
              />
              <div *ngIf="loginForm.get('email')?.invalid && loginForm.get('email')?.touched" 
                   class="text-sm text-destructive mt-1">
                Email inválido
              </div>
            </div>

            <!-- Password -->
            <div>
              <label for="password" class="block text-sm font-medium mb-2">Senha</label>
              <input
                id="password"
                type="password"
                formControlName="password"
                class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
              />
              <div *ngIf="loginForm.get('password')?.invalid && loginForm.get('password')?.touched" 
                   class="text-sm text-destructive mt-1">
                Senha deve ter no mínimo 6 caracteres
              </div>
            </div>

            <!-- Error Message -->
            <div *ngIf="errorMessage" class="p-3 text-sm bg-destructive/10 text-destructive rounded-md">
              {{ errorMessage }}
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              [disabled]="loginForm.invalid || loading"
              class="w-full inline-flex items-center justify-center rounded-md font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 disabled:opacity-50"
            >
              {{ loading ? 'Entrando...' : 'Entrar' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Footer -->
      <div class="flex items-center p-6 pt-0 justify-center">
        <p class="text-sm text-muted-foreground">
          Não tem uma conta?
          <a routerLink="/auth/register" class="text-primary hover:underline ml-1">Registre-se</a>
        </p>
      </div>
    </div>
  </div>
</div>
```

## 🚀 Executar o Frontend

```bash
cd /opt/frota-leve/frontend
npm start
```

Acesse: **http://localhost:4200**

## 📚 Documentação Completa

- Backend API: http://localhost:3000/api
- Frontend: http://localhost:4200
- Database: PostgreSQL em localhost:5432
- pgAdmin: http://localhost:5050

## 🎯 Credenciais de Teste

Após rodar `npm run seed` no backend:

**Admin:**
- Email: admin@frotaleve.com
- Senha: Admin@123

**Motorista:**
- Email: motorista@frotaleve.com  
- Senha: Driver@123

---

**Próximo Passo:** Execute os comandos `ng generate` acima e copie os códigos fornecidos! 🚀
