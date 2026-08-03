import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private readonly onlineState = signal(navigator.onLine);
  readonly online = this.onlineState.asReadonly();

  constructor() {
    window.addEventListener('online', () => this.onlineState.set(true));
    window.addEventListener('offline', () => this.onlineState.set(false));
  }
}
