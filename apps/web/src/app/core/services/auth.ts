import { computed, Injectable, signal } from '@angular/core';
import { StorageService } from './storage';

type AppSession = {
  accessToken: string;
  tenantId: string;
  userRole: string;
  userEmail: string;
  userName: string;
};

const SESSION_STORAGE_KEY = 'frota_leve_session';
const DEMO_EMAIL = 'admin@demo.com';
const DEMO_PASSWORD = '123456';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly sessionState = signal<AppSession | null>(null);

  readonly session = computed(() => this.sessionState());
  readonly isAuthenticated = computed(() => this.sessionState() !== null);

  constructor(private readonly storageService: StorageService) {
    this.sessionState.set(this.storageService.getObject<AppSession>(SESSION_STORAGE_KEY));
  }

  authenticateDemo(email: string, password: string): boolean {
    if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      return false;
    }

    this.setSession({
      accessToken: 'demo-access-token',
      tenantId: 'tenant-demo',
      userRole: 'OWNER',
      userEmail: DEMO_EMAIL,
      userName: 'Administrador Demo',
    });

    return true;
  }

  clearSession(): void {
    this.sessionState.set(null);
    this.storageService.remove(SESSION_STORAGE_KEY);
  }

  getAccessToken(): string | null {
    return this.sessionState()?.accessToken ?? null;
  }

  getTenantId(): string | null {
    return this.sessionState()?.tenantId ?? null;
  }

  getCurrentRole(): string | null {
    return this.sessionState()?.userRole ?? null;
  }

  hasAnyRole(roles: string[]): boolean {
    const currentRole = this.getCurrentRole();

    return Boolean(currentRole && roles.includes(currentRole));
  }

  private setSession(session: AppSession): void {
    this.sessionState.set(session);
    this.storageService.setObject(SESSION_STORAGE_KEY, session);
  }
}
