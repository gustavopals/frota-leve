import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/services/api';
import type { ReportDetail, ReportListResponse } from './ai-reports.types';

@Injectable({ providedIn: 'root' })
export class AiReportsService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  list(page = 1, limit = 12): Observable<ReportListResponse> {
    return this.api.get<ReportListResponse>('/ai/reports', {
      params: { page: String(page), limit: String(limit) },
    });
  }

  getById(id: string): Observable<{ success: true; data: ReportDetail }> {
    return this.api.get<{ success: true; data: ReportDetail }>(`/ai/reports/${id}`);
  }

  generateOnDemand(period: string): Observable<{ success: true; data: ReportDetail }> {
    return this.api.post<{ success: true; data: ReportDetail }>('/ai/reports/on-demand', {
      period,
    });
  }

  /** Download binário: usa HttpClient direto porque o ApiService assume JSON. */
  downloadPdf(id: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/ai/reports/${id}/pdf`, {
      responseType: 'blob',
    });
  }
}
