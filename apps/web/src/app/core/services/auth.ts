import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { UserRole } from '@frota-leve/shared/src/enums/user-role.enum';
import type { Subscription } from 'rxjs';
import {
  BehaviorSubject,
  Observable,
  catchError,
  finalize,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { ApiService } from './api';
import { StorageService } from './storage';

export type AuthUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthTenant = {
  id: string;
  name: string;
  plan: string;
  status: string;
  trialEndsAt: string | null;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  tenant: AuthTenant;
};

type LoginPayload = {
  email: string;
  password: string;
};

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  companyName: string;
  cnpj: string;
};

type ForgotPasswordPayload = {
  email: string;
};

type ResetPasswordPayload = {
  token: string;
  newPassword: string;
  confirmPassword: string;
};

type AuthResponse = AuthSession;

type MeResponse = {
  user: AuthUser;
  tenant: AuthTenant;
};

type JwtPayload = {
  exp?: number;
};

const SESSION_STORAGE_KEY = 'frota_leve_auth_session';
const REFRESH_BUFFER_MS = 2 * 60 * 1000;

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly sessionSubject = new BehaviorSubject<AuthSession | null>(null);
  private readonly currentUserSubject = new BehaviorSubject<AuthUser | null>(null);
  private readonly currentTenantSubject = new BehaviorSubject<AuthTenant | null>(null);
  private refreshRequest$: Observable<AuthSession> | null = null;
  private refreshSubscription: Subscription | null = null;

  readonly session$ = this.sessionSubject.asObservable();
  readonly currentUser$ = this.currentUserSubject.asObservable();
  readonly currentTenant$ = this.currentTenantSubject.asObservable();

  constructor(
    private readonly apiService: ApiService,
    private readonly router: Router,
    private readonly storageService: StorageService,
  ) {
    const storedSession = this.storageService.getObject<AuthSession>(SESSION_STORAGE_KEY);

    if (!storedSession) {
      return;
    }

    if (this.isTokenExpired(storedSession.refreshToken)) {
      this.clearSession();
      return;
    }

    this.applySession(storedSession, false, false);

    if (this.isTokenExpired(storedSession.accessToken)) {
      void this.refreshToken().subscribe({
        error: () => {
          this.clearSession();
        },
      });
      return;
    }

    this.scheduleTokenRefresh(storedSession.accessToken);
  }

  login(payload: LoginPayload): Observable<AuthSession> {
    return this.apiService
      .post<AuthResponse, LoginPayload>('auth/login', {
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
      })
      .pipe(
        tap((session) => {
          this.applySession(session);
        }),
      );
  }

  register(payload: RegisterPayload): Observable<AuthSession> {
    return this.apiService.post<AuthResponse, RegisterPayload>('auth/register', payload).pipe(
      tap((session) => {
        this.applySession(session);
      }),
    );
  }

  forgotPassword(
    payload: ForgotPasswordPayload,
  ): Observable<{ success: boolean; message: string }> {
    return this.apiService.post<{ success: boolean; message: string }, ForgotPasswordPayload>(
      'auth/forgot-password',
      {
        email: payload.email.trim().toLowerCase(),
      },
    );
  }

  resetPassword(payload: ResetPasswordPayload): Observable<{ success: boolean; message: string }> {
    return this.apiService.post<{ success: boolean; message: string }, ResetPasswordPayload>(
      'auth/reset-password',
      payload,
    );
  }

  refreshToken(): Observable<AuthSession> {
    if (this.refreshRequest$) {
      return this.refreshRequest$;
    }

    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      return throwError(() => new Error('Nenhum refresh token disponivel.'));
    }

    this.refreshRequest$ = this.apiService
      .post<AuthResponse, { refreshToken: string }>('auth/refresh', {
        refreshToken,
      })
      .pipe(
        tap((session) => {
          this.applySession(session);
        }),
        catchError((error) => {
          this.clearSession();
          return throwError(() => error);
        }),
        finalize(() => {
          this.refreshRequest$ = null;
        }),
        shareReplay(1),
      );

    return this.refreshRequest$;
  }

  getMe(): Observable<MeResponse> {
    return this.apiService.get<MeResponse>('auth/me').pipe(
      tap((response) => {
        const currentSession = this.sessionSubject.value;

        if (!currentSession) {
          return;
        }

        this.applySession(
          {
            ...currentSession,
            user: response.user,
            tenant: response.tenant,
          },
          true,
        );
      }),
    );
  }

  logout(): void {
    this.clearSession();
    void this.router.navigate(['/auth/login']);
  }

  clearSession(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
      this.refreshSubscription = null;
    }

    this.sessionSubject.next(null);
    this.currentUserSubject.next(null);
    this.currentTenantSubject.next(null);
    this.storageService.remove(SESSION_STORAGE_KEY);
  }

  getAccessToken(): string | null {
    return this.sessionSubject.value?.accessToken ?? null;
  }

  getRefreshToken(): string | null {
    return this.sessionSubject.value?.refreshToken ?? null;
  }

  getTenantId(): string | null {
    return this.sessionSubject.value?.tenant.id ?? null;
  }

  getCurrentRole(): UserRole | null {
    return this.currentUserSubject.value?.role ?? null;
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  getCurrentTenant(): AuthTenant | null {
    return this.currentTenantSubject.value;
  }

  hasAnyRole(roles: string[]): boolean {
    const currentRole = this.getCurrentRole();

    return Boolean(currentRole && roles.includes(currentRole));
  }

  isAuthenticated(): boolean {
    const session = this.sessionSubject.value;

    return Boolean(
      session &&
      this.currentUserSubject.value &&
      session.refreshToken &&
      !this.isTokenExpired(session.refreshToken),
    );
  }

  private applySession(session: AuthSession, persist = true, scheduleRefresh = true): void {
    this.sessionSubject.next(session);
    this.currentUserSubject.next(session.user);
    this.currentTenantSubject.next(session.tenant);

    if (persist) {
      this.storageService.setObject(SESSION_STORAGE_KEY, session);
    }

    if (scheduleRefresh) {
      this.scheduleTokenRefresh(session.accessToken);
    }
  }

  private scheduleTokenRefresh(accessToken: string): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
      this.refreshSubscription = null;
    }

    const payload = this.parseJwtPayload(accessToken);

    if (!payload?.exp || typeof window === 'undefined') {
      return;
    }

    const refreshAt = payload.exp * 1000 - REFRESH_BUFFER_MS;
    const delay = Math.max(refreshAt - Date.now(), 0);

    this.refreshSubscription = new Observable<void>((subscriber) => {
      const timeoutId = window.setTimeout(() => {
        subscriber.next();
        subscriber.complete();
      }, delay);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }).subscribe({
      next: () => {
        void this.refreshToken().subscribe({
          error: () => {
            this.clearSession();
            void this.router.navigate(['/auth/login']);
          },
        });
      },
    });
  }

  private parseJwtPayload(token: string): JwtPayload | null {
    const segments = token.split('.');

    if (segments.length < 2 || typeof globalThis.atob !== 'function') {
      return null;
    }

    try {
      const normalizedPayload = segments[1].replace(/-/g, '+').replace(/_/g, '/');
      const paddedPayload = normalizedPayload.padEnd(
        Math.ceil(normalizedPayload.length / 4) * 4,
        '=',
      );
      return JSON.parse(globalThis.atob(paddedPayload)) as JwtPayload;
    } catch {
      return null;
    }
  }

  private isTokenExpired(token: string): boolean {
    const payload = this.parseJwtPayload(token);

    if (!payload?.exp) {
      return true;
    }

    return payload.exp * 1000 <= Date.now();
  }
}
