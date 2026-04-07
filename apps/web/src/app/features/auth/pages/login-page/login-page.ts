import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/services/auth';
import { NotificationService } from '../../../../core/services/notification';

@Component({
  selector: 'app-login-page',
  standalone: false,
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  appName = environment.appName;
  version = environment.version;
  credentials = {
    email: 'admin@demo.com',
    password: '123456',
  };

  constructor(
    private readonly activatedRoute: ActivatedRoute,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly notificationService: NotificationService,
  ) {}

  enterDemo(): void {
    const authenticated = this.authService.authenticateDemo(
      this.credentials.email,
      this.credentials.password,
    );

    if (!authenticated) {
      this.notificationService.warning('Use as credenciais demo para acessar o ambiente inicial.');
      return;
    }

    const returnUrl = this.activatedRoute.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';

    void this.router.navigateByUrl(returnUrl);
  }
}
