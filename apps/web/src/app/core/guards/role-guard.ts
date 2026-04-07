import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth';
import { NotificationService } from '../services/notification';

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const notificationService = inject(NotificationService);
  const router = inject(Router);
  const roles = route.data['roles'];

  if (!Array.isArray(roles) || roles.length === 0 || authService.hasAnyRole(roles)) {
    return true;
  }

  notificationService.warning('Seu perfil atual nao possui acesso a esta area.');
  return router.createUrlTree(['/dashboard']);
};
