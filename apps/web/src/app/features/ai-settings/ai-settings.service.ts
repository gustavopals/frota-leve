import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api';
import type { AiSettings, AiUsageLog, AiUsageOverview } from './ai-settings.types';

@Injectable({ providedIn: 'root' })
export class AiSettingsService {
  private readonly api = inject(ApiService);

  get(): Observable<{ success: true; data: AiSettings }> {
    return this.api.get<{ success: true; data: AiSettings }>('/ai/settings');
  }

  update(patch: Partial<AiSettings>): Observable<{ success: true; data: AiSettings }> {
    return this.api.patch<{ success: true; data: AiSettings }>('/ai/settings', patch);
  }

  getUsageOverview(): Observable<{ success: true; data: AiUsageOverview }> {
    return this.api.get<{ success: true; data: AiUsageOverview }>('/ai/settings/usage-overview');
  }

  getLogs(page = 1, limit = 50): Observable<{ success: true; data: AiUsageLog[] }> {
    return this.api.get<{ success: true; data: AiUsageLog[] }>('/ai/settings/logs', {
      params: { page: String(page), limit: String(limit) },
    });
  }
}
