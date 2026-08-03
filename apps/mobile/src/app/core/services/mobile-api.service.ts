import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import type {
  ApiEnvelope,
  ChecklistSubmission,
  ChecklistTemplate,
  FuelSubmission,
  MobileContext,
  MobileNotification,
  PaginatedResponse,
  ProblemSubmission,
  ResponsibilityTerm,
} from '../models/mobile.models';
import { mobileCacheScope } from './auth.service';

@Injectable({ providedIn: 'root' })
export class MobileApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  getContext(forceRefresh = false) {
    let params = this.scopedParams();
    if (forceRefresh) params = params.set('refresh', Date.now());
    return this.http.get<ApiEnvelope<MobileContext>>(`${this.baseUrl}/mobile/context`, {
      params,
    });
  }

  getChecklistTemplates() {
    return this.http.get<ApiEnvelope<ChecklistTemplate[]>>(
      `${this.baseUrl}/mobile/checklist-templates`,
      { params: this.scopedParams() },
    );
  }

  submitChecklist(payload: ChecklistSubmission) {
    return this.http.post<ApiEnvelope<{ id: string }>>(
      `${this.baseUrl}/mobile/checklist-executions`,
      payload,
    );
  }

  submitFuel(payload: FuelSubmission) {
    return this.http.post<ApiEnvelope<{ id: string }>>(
      `${this.baseUrl}/mobile/fuel-records`,
      payload,
    );
  }

  submitProblem(payload: ProblemSubmission) {
    return this.http.post<ApiEnvelope<{ id: string }>>(`${this.baseUrl}/mobile/problems`, payload);
  }

  signTerm(termId: string, signatureUrl: string, location: string | null) {
    return this.http.post<ApiEnvelope<ResponsibilityTerm>>(
      `${this.baseUrl}/mobile/responsibility-terms/${termId}/sign`,
      { signatureUrl, location },
    );
  }

  upload(file: Blob, fileName: string) {
    const formData = new FormData();
    formData.append('file', file, fileName);
    return this.http.post<ApiEnvelope<{ url: string }>>(`${this.baseUrl}/mobile/uploads`, formData);
  }

  listNotifications(page = 1, pageSize = 30) {
    const params = this.scopedParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PaginatedResponse<MobileNotification>>(`${this.baseUrl}/notifications`, {
      params,
    });
  }

  markNotificationRead(id: string) {
    return this.http.patch<MobileNotification>(`${this.baseUrl}/notifications/${id}/read`, {});
  }

  markAllNotificationsRead() {
    return this.http.patch<{ updatedCount: number }>(`${this.baseUrl}/notifications/read-all`, {});
  }

  extractFuelReceipt(file: Blob, fileName: string) {
    const formData = new FormData();
    formData.append('image', file, fileName);
    return this.http.post<ApiEnvelope<Record<string, unknown>>>(
      `${this.baseUrl}/ai/ocr/fuel`,
      formData,
    );
  }

  private scopedParams(): HttpParams {
    return new HttpParams().set('mobileCache', mobileCacheScope());
  }
}
