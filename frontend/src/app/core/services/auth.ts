import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  tenantName: string;
  tenantDocument?: string;
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    tenantId: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = environment.apiUrl;
  private readonly TOKEN_KEY = 'access_token';
  
  currentUser = signal<AuthResponse['user'] | null>(null);
  isAuthenticated = signal<boolean>(false);

  constructor(private http: HttpClient, private router: Router) {
    this.checkAuth();
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/auth/login`, credentials)
      .pipe(tap(response => this.handleAuthSuccess(response)));
  }

  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/auth/register`, data)
      .pipe(tap(response => this.handleAuthSuccess(response)));
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem('current_user');
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private handleAuthSuccess(response: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, response.access_token);
    localStorage.setItem('current_user', JSON.stringify(response.user));
    this.currentUser.set(response.user);
    this.isAuthenticated.set(true);
    this.router.navigate(['/dashboard']);
  }

  private checkAuth(): void {
    const token = this.getToken();
    const userStr = localStorage.getItem('current_user');
    if (token && userStr) {
      this.currentUser.set(JSON.parse(userStr));
      this.isAuthenticated.set(true);
    }
  }
}
