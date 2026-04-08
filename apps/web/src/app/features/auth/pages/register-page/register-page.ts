import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PoButtonModule, PoFieldModule } from '@po-ui/ng-components';
import { finalize } from 'rxjs';
import {
  cnpjValidator,
  sameValueValidator,
  strongPasswordValidator,
} from '../../auth-form-validators';
import { AuthService } from '../../../../core/services/auth';
import { NotificationService } from '../../../../core/services/notification';

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink, PoFieldModule, PoButtonModule],
  templateUrl: './register-page.html',
  styleUrl: './register-page.scss',
})
export class RegisterPage {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly notificationService = inject(NotificationService);

  isSubmitting = false;

  readonly form = this.formBuilder.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, strongPasswordValidator()]],
      confirmPassword: ['', [Validators.required]],
      companyName: ['', [Validators.required, Validators.minLength(2)]],
      cnpj: ['', [Validators.required, cnpjValidator()]],
    },
    {
      validators: [sameValueValidator('password', 'confirmPassword')],
    },
  );

  submit(): void {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    const { confirmPassword: _confirmPassword, ...payload } = this.form.getRawValue();

    this.isSubmitting = true;

    this.authService
      .register(payload)
      .pipe(
        finalize(() => {
          this.isSubmitting = false;
        }),
      )
      .subscribe({
        next: () => {
          this.notificationService.success('Conta criada com sucesso.');
          void this.router.navigate(['/onboarding']);
        },
      });
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

    if (control.hasError('email')) {
      errors.push('Use um e-mail válido.');
    }

    if (control.hasError('minlength')) {
      errors.push('Use pelo menos 2 caracteres.');
    }

    if (control.hasError('cnpj')) {
      errors.push('Informe um CNPJ válido.');
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
      errors.push('A confirmação precisa ser igual à senha.');
    }

    return errors;
  }
}
