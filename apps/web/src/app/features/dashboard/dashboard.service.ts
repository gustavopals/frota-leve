import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { DashboardSummaryResponse } from '@frota-leve/shared/src/types/dashboard.type';
import { ApiService } from '../../core/services/api';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {
  private readonly apiService = inject(ApiService);

  getSummary(): Observable<DashboardSummaryResponse> {
    return this.apiService.get<DashboardSummaryResponse>('dashboard/summary');
  }
}
