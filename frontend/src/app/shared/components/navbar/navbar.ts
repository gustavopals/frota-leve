import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle';

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, RouterLink, ThemeToggleComponent],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.scss']
})
export class NavbarComponent {
  constructor(public authService: AuthService) {}

  get currentUser() {
    return this.authService.currentUser;
  }

  logout() {
    this.authService.logout();
  }
}
