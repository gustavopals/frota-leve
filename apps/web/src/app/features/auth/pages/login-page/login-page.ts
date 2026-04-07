import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/services/auth';
import { NotificationService } from '../../../../core/services/notification';

@Component({
  selector: 'app-login-page',
  standalone: false,
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);

  appName = environment.appName;
  version = environment.version;
  isSubmitting = false;
  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    this.authService
      .login(this.form.getRawValue())
      .pipe(
        finalize(() => {
          this.isSubmitting = false;
        }),
      )
      .subscribe({
        next: () => {
          const returnUrl =
            this.activatedRoute.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
          this.notificationService.success('Login realizado com sucesso.');
          void this.router.navigateByUrl(returnUrl);
        },
      });
  }

  protected get emailErrors(): string[] {
    const control = this.form.controls.email;

    if (!control.touched || !control.errors) {
      return [];
    }

    const errors: string[] = [];

    if (control.hasError('required')) {
      errors.push('Informe seu e-mail.');
    }

    if (control.hasError('email')) {
      errors.push('Use um e-mail válido.');
    }

    return errors;
  }

  protected get passwordErrors(): string[] {
    const control = this.form.controls.password;

    if (!control.touched || !control.errors) {
      return [];
    }

    if (control.hasError('required')) {
      return ['Informe sua senha.'];
    }

    return [];
  }
}
