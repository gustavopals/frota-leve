import { Injectable } from '@angular/core';
import type { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { AuthService } from '../services/auth';

@Injectable()
export class TenantInterceptor implements HttpInterceptor {
  constructor(private readonly authService: AuthService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const tenantId = this.authService.getTenantId();

    if (!tenantId) {
      return next.handle(request);
    }

    return next.handle(
      request.clone({
        setHeaders: {
          'X-Tenant-Id': tenantId,
        },
      }),
    );
  }
}
