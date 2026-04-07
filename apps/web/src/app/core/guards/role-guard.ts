import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import type {
  ActivatedRouteSnapshot,
  CanActivate,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { AuthService } from '../services/auth';
import { NotificationService } from '../services/notification';

@Injectable({
  providedIn: 'root',
})
export class RoleGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly notificationService: NotificationService,
    private readonly router: Router,
  ) {}

  canActivate(route: ActivatedRouteSnapshot, _state: RouterStateSnapshot): boolean | UrlTree {
    const roles = route.data['roles'];

    if (!Array.isArray(roles) || roles.length === 0 || this.authService.hasAnyRole(roles)) {
      return true;
    }

    this.notificationService.warning('Seu perfil atual nao possui acesso a esta area.');

    return this.router.createUrlTree(['/dashboard']);
  }
}
