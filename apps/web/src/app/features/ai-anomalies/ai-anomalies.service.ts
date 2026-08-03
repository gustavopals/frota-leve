import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api';
import type {
  AnomalyListFilters,
  AnomalyListResponse,
  AnomalyRecord,
  VehicleAiAnalysis,
} from './ai-anomalies.types';

@Injectable({ providedIn: 'root' })
export class AiAnomaliesService {
  private readonly api = inject(ApiService);

  list(filters: AnomalyListFilters = {}): Observable<AnomalyListResponse> {
    const params: Record<string, string> = {};

    if (filters.status) {
      params['status'] = filters.status;
    }

    if (filters.kind) {
      params['kind'] = filters.kind;
    }

    if (filters.severity) {
      params['severity'] = filters.severity;
    }

    params['page'] = String(filters.page ?? 1);
    params['limit'] = String(filters.limit ?? 20);

    return this.api.get<AnomalyListResponse>('/ai/anomalies', { params });
  }

  /** Top 5 abertas HIGH+MED — usado pelo widget "Insights IA" do dashboard. */
  listInsights(): Observable<{ success: true; data: AnomalyRecord[] }> {
    return this.api.get<{ success: true; data: AnomalyRecord[] }>('/ai/anomalies/insights');
  }

  getVehicleAnalysis(vehicleId: string): Observable<{ success: true; data: VehicleAiAnalysis }> {
    return this.api.get<{ success: true; data: VehicleAiAnalysis }>(
      `/ai/anomalies/vehicle/${vehicleId}`,
    );
  }

  acknowledge(id: string): Observable<{ success: true; data: AnomalyRecord }> {
    return this.api.post<{ success: true; data: AnomalyRecord }>(
      `/ai/anomalies/${id}/acknowledge`,
      {},
    );
  }

  dismiss(id: string): Observable<{ success: true; data: AnomalyRecord }> {
    return this.api.post<{ success: true; data: AnomalyRecord }>(`/ai/anomalies/${id}/dismiss`, {});
  }
}
