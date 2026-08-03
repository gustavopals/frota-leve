import { inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, of, tap } from 'rxjs';
import type { MobileContext } from '../models/mobile.models';
import { MobileApiService } from './mobile-api.service';

const CONTEXT_CACHE_KEY = 'frota-mobile.context';

function cachedContext(): MobileContext | null {
  const raw = localStorage.getItem(CONTEXT_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MobileContext;
  } catch {
    localStorage.removeItem(CONTEXT_CACHE_KEY);
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class ContextStoreService {
  private readonly api = inject(MobileApiService);
  private readonly state = signal<MobileContext | null>(cachedContext());
  private readonly loadingState = signal(false);

  readonly context = this.state.asReadonly();
  readonly loading = this.loadingState.asReadonly();

  constructor() {
    window.addEventListener('frota-mobile:session-cleared', () => this.clear());
  }

  refresh(forceRefresh = false) {
    this.loadingState.set(true);
    return this.api.getContext(forceRefresh).pipe(
      tap(({ data }) => {
        localStorage.setItem(CONTEXT_CACHE_KEY, JSON.stringify(data));
        this.state.set(data);
      }),
      catchError(() => of(null)),
      finalize(() => this.loadingState.set(false)),
    );
  }

  clear(): void {
    localStorage.removeItem(CONTEXT_CACHE_KEY);
    this.state.set(null);
  }
}
