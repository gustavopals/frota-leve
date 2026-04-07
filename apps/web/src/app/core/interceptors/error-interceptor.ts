import type { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth';
import { NotificationService } from '../services/notification';

@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(
    private readonly authService: AuthService,
    private readonly notificationService: NotificationService,
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          this.handleHttpError(request, error);
        }

        return throwError(() => error);
      }),
    );
  }

  private handleHttpError(request: HttpRequest<unknown>, error: HttpErrorResponse): void {
    const isAuthRequest =
      /\/auth\/(login|register|forgot-password|reset-password|refresh)(?:\?|$)/.test(request.url);

    if (error.status === 401) {
      if (!isAuthRequest && this.authService.isAuthenticated()) {
        this.authService.logout();
        this.notificationService.warning('Sua sessao expirou. Faca login novamente.');
        return;
      }

      this.notificationService.warning(this.resolveClientErrorMessage(error));

      return;
    }

    if (error.status >= 500) {
      this.notificationService.error('O servidor nao respondeu como esperado. Tente novamente.');

      return;
    }

    if (error.status >= 400) {
      this.notificationService.warning(this.resolveClientErrorMessage(error));
    }
  }

  private resolveClientErrorMessage(error: HttpErrorResponse): string {
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
}
