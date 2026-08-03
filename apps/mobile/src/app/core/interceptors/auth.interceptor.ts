import type { HttpInterceptorFn } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';
import type { AuthResponse } from '../models/mobile.models';
import { AuthService } from '../services/auth.service';

let refreshRequest: Observable<AuthResponse> | null = null;

function refreshOnce(auth: AuthService): Observable<AuthResponse> {
  if (!refreshRequest) {
    refreshRequest = auth.refresh().pipe(
      shareReplay({ bufferSize: 1, refCount: false }),
      finalize(() => {
        refreshRequest = null;
      }),
    );
  }
  return refreshRequest;
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken();
  const authenticatedRequest = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !auth.refreshToken()) {
        return throwError(() => error);
      }

      return refreshOnce(auth).pipe(
        switchMap((response) =>
          next(
            request.clone({
              setHeaders: { Authorization: `Bearer ${response.accessToken}` },
            }),
          ),
        ),
        catchError((refreshError: unknown) => {
          auth.logout();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
