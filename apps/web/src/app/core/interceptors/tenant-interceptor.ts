import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth';

export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
  const tenantId = inject(AuthService).getTenantId();

  if (!tenantId) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { 'X-Tenant-Id': tenantId } }));
};
