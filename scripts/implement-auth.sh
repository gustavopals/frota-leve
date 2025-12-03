#!/bin/bash

# AUTH ROUTES
cat > src/app/features/auth/auth.routes.ts << 'EOF'
import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register').then(m => m.RegisterComponent)
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  }
];
EOF

# LOGIN COMPONENT
cat > src/app/features/auth/pages/login/login.ts << 'EOF'
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
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
          this.errorMessage = error.error?.message || 'Erro ao fazer login. Verifique suas credenciais.';
          this.loading = false;
        },
        complete: () => {
          this.loading = false;
        }
      });
    }
  }
}
EOF

cat > src/app/features/auth/pages/login/login.html << 'EOF'
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
EOF

# REGISTER COMPONENT
cat > src/app/features/auth/pages/register/register.ts << 'EOF'
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth';

@Component({
  selector: 'app-register',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrls: ['./register.scss']
})
export class RegisterComponent {
  registerForm: FormGroup;
  loading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      tenantName: ['', Validators.required],
      tenantDocument: [''],
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null : { 'mismatch': true };
  }

  onSubmit(): void {
    if (this.registerForm.valid && !this.loading) {
      this.loading = true;
      this.errorMessage = '';

      const { confirmPassword, ...registerData } = this.registerForm.value;

      this.authService.register(registerData).subscribe({
        next: () => {
          this.router.navigate(['/dashboard']);
        },
        error: (error: any) => {
          this.errorMessage = error.error?.message || 'Erro ao criar conta. Tente novamente.';
          this.loading = false;
        },
        complete: () => {
          this.loading = false;
        }
      });
    }
  }
}
EOF

cat > src/app/features/auth/pages/register/register.html << 'EOF'
<div class="min-h-screen flex items-center justify-center bg-background p-4">
  <div class="w-full max-w-md">
    <div class="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div class="flex flex-col space-y-1.5 p-6 text-center">
        <h3 class="text-2xl font-semibold">Criar Conta</h3>
        <p class="text-sm text-muted-foreground">Preencha os dados para começar</p>
      </div>
      
      <div class="p-6 pt-0">
        <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-2">Nome da Empresa</label>
              <input
                type="text"
                formControlName="tenantName"
                class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Minha Empresa Ltda"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">CNPJ (opcional)</label>
              <input
                type="text"
                formControlName="tenantDocument"
                class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Seu Nome</label>
              <input
                type="text"
                formControlName="name"
                class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="João Silva"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                formControlName="email"
                class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Senha</label>
              <input
                type="password"
                formControlName="password"
                class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Confirmar Senha</label>
              <input
                type="password"
                formControlName="confirmPassword"
                class="w-full px-3 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••"
              />
              <div *ngIf="registerForm.errors?.['mismatch'] && registerForm.get('confirmPassword')?.touched" class="text-sm text-destructive mt-1">
                As senhas não coincidem
              </div>
            </div>

            <div *ngIf="errorMessage" class="p-3 text-sm bg-destructive/10 text-destructive rounded-md">
              {{ errorMessage }}
            </div>

            <button
              type="submit"
              [disabled]="registerForm.invalid || loading"
              class="w-full inline-flex items-center justify-center rounded-md font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 disabled:opacity-50"
            >
              {{ loading ? 'Criando conta...' : 'Criar Conta' }}
            </button>
          </div>
        </form>
      </div>

      <div class="flex items-center p-6 pt-0 justify-center">
        <p class="text-sm text-muted-foreground">
          Já tem uma conta?
          <a routerLink="/auth/login" class="text-primary hover:underline ml-1">Faça login</a>
        </p>
      </div>
    </div>
  </div>
</div>
EOF

echo "✅ Componentes de Auth implementados!"
