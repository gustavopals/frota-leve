import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { isValidCNPJ } from '@frota-leve/shared/src/utils/validation.utils';

export function cnpjValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (typeof value !== 'string' || value.trim() === '') {
      return null;
    }

    return isValidCNPJ(value) ? null : { cnpj: true };
  };
}

export function strongPasswordValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (typeof value !== 'string' || value.trim() === '') {
      return null;
    }

    const hasMinimumLength = value.length >= 8;
    const hasUppercase = /[A-Z]/.test(value);
    const hasNumber = /[0-9]/.test(value);

    if (hasMinimumLength && hasUppercase && hasNumber) {
      return null;
    }

    return {
      strongPassword: {
        hasMinimumLength,
        hasUppercase,
        hasNumber,
      },
    };
  };
}

export function sameValueValidator(
  sourceControlName: string,
  targetControlName: string,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const sourceControl = control.get(sourceControlName);
    const targetControl = control.get(targetControlName);

    if (!sourceControl || !targetControl) {
      return null;
    }

    return sourceControl.value === targetControl.value ? null : { sameValue: true };
  };
}
