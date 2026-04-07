import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth';
import { NotificationService } from '../services/notification';

function resolveClientErrorMessage(error: HttpErrorResponse): string {
  if (typeof error.error === 'string' && error.error.trim()) {
    return error.error;
  }

  if (typeof error.error === 'object' && error.error) {
    if ('message' in error.error) {
      const message = error.error.message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }

    if (
      'error' in error.error &&
      typeof error.error.error === 'object' &&
      error.error.error &&
      'message' in error.error.error
    ) {
      const message = error.error.error.message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }
  }

  return 'Nao foi possivel concluir a operacao solicitada.';
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const notificationService = inject(NotificationService);
  const isAuthRequest =
    /\/auth\/(login|register|forgot-password|reset-password|refresh)(?:\?|$)/.test(req.url);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => error);
      }

      if (error.status === 401) {
        if (!isAuthRequest && authService.isAuthenticated()) {
          authService.logout();
          notificationService.warning('Sua sessao expirou. Faca login novamente.');
          return throwError(() => error);
        }

        notificationService.warning(resolveClientErrorMessage(error));
        return throwError(() => error);
      }

      if (error.status >= 500) {
        notificationService.error('O servidor nao respondeu como esperado. Tente novamente.');
      } else if (error.status >= 400) {
        notificationService.warning(resolveClientErrorMessage(error));
      }

      return throwError(() => error);
    }),
  );
};
