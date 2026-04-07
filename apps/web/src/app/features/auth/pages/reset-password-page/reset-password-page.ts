import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { sameValueValidator, strongPasswordValidator } from '../../auth-form-validators';
import { AuthService } from '../../../../core/services/auth';
import { NotificationService } from '../../../../core/services/notification';

@Component({
  selector: 'app-reset-password-page',
  standalone: false,
  templateUrl: './reset-password-page.html',
  styleUrl: './reset-password-page.scss',
})
export class ResetPasswordPage {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);

  isSubmitting = false;
  readonly token = this.activatedRoute.snapshot.queryParamMap.get('token');
  readonly form = this.formBuilder.nonNullable.group(
    {
      newPassword: ['', [Validators.required, strongPasswordValidator()]],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: [sameValueValidator('newPassword', 'confirmPassword')],
    },
  );

  submit(): void {
    if (!this.token) {
      this.notificationService.warning('Link de redefinicao invalido.');
      return;
    }

    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    this.authService
      .resetPassword({
        token: this.token,
        ...this.form.getRawValue(),
      })
      .pipe(
        finalize(() => {
          this.isSubmitting = false;
        }),
      )
      .subscribe({
        next: () => {
          this.notificationService.success('Senha redefinida com sucesso.');
          void this.router.navigate(['/auth/login']);
        },
      });
  }

  goToLogin(): void {
    void this.router.navigate(['/auth/login']);
  }

  protected fieldErrors(controlName: keyof typeof this.form.controls): string[] {
    const control = this.form.controls[controlName];

    if (!control.touched || !control.errors) {
      return [];
    }

    const errors: string[] = [];

    if (control.hasError('required')) {
      errors.push('Campo obrigatório.');
    }

    const strongPassword = control.getError('strongPassword') as
      | {
          hasMinimumLength: boolean;
          hasUppercase: boolean;
          hasNumber: boolean;
        }
      | undefined;

    if (strongPassword) {
      if (!strongPassword.hasMinimumLength) {
        errors.push('A senha precisa ter ao menos 8 caracteres.');
      }

      if (!strongPassword.hasUppercase) {
        errors.push('A senha precisa ter ao menos uma letra maiúscula.');
      }

      if (!strongPassword.hasNumber) {
        errors.push('A senha precisa ter ao menos um número.');
      }
    }

    if (
      controlName === 'confirmPassword' &&
      this.form.hasError('sameValue') &&
      this.form.controls.confirmPassword.touched
    ) {
      errors.push('A confirmação precisa ser igual à nova senha.');
    }

    return errors;
  }
}
