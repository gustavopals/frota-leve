import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ContextStoreService } from '../../core/services/context-store.service';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly contextStore = inject(ContextStoreService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly passwordVisible = signal(false);

  submit(): void {
    if (!this.email.trim() || !this.password) {
      this.error.set('Informe seu e-mail e senha.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.auth
      .login(this.email.trim().toLowerCase(), this.password)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          if (response.user.role !== 'DRIVER') {
            this.auth.logout(false);
            this.error.set('Este aplicativo é exclusivo para usuários com perfil Motorista.');
            return;
          }

          this.contextStore.clear();
          void this.router.navigate(['/home']);
        },
        error: (error: unknown) => {
          const message =
            error instanceof HttpErrorResponse
              ? ((error.error as { error?: { message?: string } })?.error?.message ??
                'Não foi possível entrar. Confira seus dados.')
              : 'Não foi possível entrar. Confira seus dados.';
          this.error.set(message);
        },
      });
  }

  togglePassword(): void {
    this.passwordVisible.update((visible) => !visible);
  }
}
