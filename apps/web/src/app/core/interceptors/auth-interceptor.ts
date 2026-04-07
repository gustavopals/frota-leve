import { Injectable } from '@angular/core';
import type { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { AuthService } from '../services/auth';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private readonly authService: AuthService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const accessToken = this.authService.getAccessToken();

    if (!accessToken) {
      return next.handle(request);
    }

    return next.handle(
      request.clone({
        setHeaders: {
          Authorization: `Bearer ${accessToken}`,
        },
      }),
    );
  }
}
