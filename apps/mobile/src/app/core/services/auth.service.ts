import { HttpBackend, HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { AuthResponse, AuthTenant, AuthUser } from '../models/mobile.models';

const ACCESS_TOKEN_KEY = 'frota-mobile.access-token';
const REFRESH_TOKEN_KEY = 'frota-mobile.refresh-token';
const USER_KEY = 'frota-mobile.user';
const TENANT_KEY = 'frota-mobile.tenant';
const CONTEXT_CACHE_KEY = 'frota-mobile.context';
const CACHE_SCOPE_KEY = 'frota-mobile.cache-scope';

export function currentMobileUserId(): string | null {
  return readJson<AuthUser>(USER_KEY)?.id ?? null;
}

export function mobileCacheScope(): string {
  return localStorage.getItem(CACHE_SCOPE_KEY) ?? 'anonymous';
}

function readJson<T>(key: string): T | null {
  const value = localStorage.getItem(key);
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly rawHttp = new HttpClient(inject(HttpBackend));
  private readonly userState = signal<AuthUser | null>(readJson<AuthUser>(USER_KEY));
  private readonly tenantState = signal<AuthTenant | null>(readJson<AuthTenant>(TENANT_KEY));

  readonly user = this.userState.asReadonly();
  readonly tenant = this.tenantState.asReadonly();
  readonly authenticated = computed(() => Boolean(this.accessToken() && this.userState()));

  accessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  refreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.rawHttp
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap((response) => this.persistSession(response)));
  }

  refresh(): Observable<AuthResponse> {
    return this.rawHttp
      .post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, {
        refreshToken: this.refreshToken(),
      })
      .pipe(tap((response) => this.persistSession(response)));
  }

  logout(redirect = true): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TENANT_KEY);
    localStorage.removeItem(CONTEXT_CACHE_KEY);
    localStorage.removeItem(CACHE_SCOPE_KEY);
    this.userState.set(null);
    this.tenantState.set(null);
    window.dispatchEvent(new Event('frota-mobile:session-cleared'));

    if (redirect) void this.router.navigate(['/login']);
  }

  private persistSession(response: AuthResponse): void {
    const previousUserId = currentMobileUserId();
    if (previousUserId !== response.user.id || !localStorage.getItem(CACHE_SCOPE_KEY)) {
      localStorage.setItem(CACHE_SCOPE_KEY, crypto.randomUUID());
    }
    localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    localStorage.setItem(TENANT_KEY, JSON.stringify(response.tenant));
    this.userState.set(response.user);
    this.tenantState.set(response.tenant);
  }
}
