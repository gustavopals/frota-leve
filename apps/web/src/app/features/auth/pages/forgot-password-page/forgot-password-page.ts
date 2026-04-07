import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/services/auth';
import { NotificationService } from '../../../../core/services/notification';

@Component({
  selector: 'app-forgot-password-page',
  standalone: false,
  templateUrl: './forgot-password-page.html',
  styleUrl: './forgot-password-page.scss',
})
export class ForgotPasswordPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);

  isSubmitting = false;
  successMessage: string | null = null;

  readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit(): void {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    this.authService
      .forgotPassword(this.form.getRawValue())
      .pipe(
        finalize(() => {
          this.isSubmitting = false;
        }),
      )
      .subscribe({
        next: (response) => {
          this.successMessage = response.message;
          this.notificationService.success('Instrucao de recuperacao processada.');
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
}
