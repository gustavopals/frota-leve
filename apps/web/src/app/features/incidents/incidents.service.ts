import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api';
import { environment } from '../../../environments/environment';
import type {
  IncidentFormPayload,
  IncidentListFilters,
  IncidentListResponse,
  IncidentRecord,
  UploadFilesResponse,
} from './incidents.types';

@Injectable({ providedIn: 'root' })
export class IncidentsService {
  private readonly apiService = inject(ApiService);
  private readonly httpClient = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl.replace(/\/+$/, '');

  list(
    filters: IncidentListFilters = {},
    page = 1,
    pageSize = 20,
  ): Observable<IncidentListResponse> {
    return this.apiService.get<IncidentListResponse>('incidents', {
      params: {
        ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(filters.driverId ? { driverId: filters.driverId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        page,
        pageSize,
      },
    });
  }

  getById(id: string): Observable<IncidentRecord> {
    return this.apiService.get<IncidentRecord>(`incidents/${id}`);
  }

  create(payload: IncidentFormPayload): Observable<IncidentRecord> {
    return this.apiService.post<IncidentRecord, IncidentFormPayload>('incidents', payload);
  }

  update(
    id: string,
    payload: IncidentFormPayload & { status: string },
  ): Observable<IncidentRecord> {
    return this.apiService.put<IncidentRecord, IncidentFormPayload & { status: string }>(
      `incidents/${id}`,
      payload,
    );
  }

  delete(id: string): Observable<{ deleted: boolean; mode: string; incidentId: string }> {
    return this.apiService.delete(`incidents/${id}`);
  }

  /** Faz upload de múltiplos arquivos e retorna as URLs persistidas */
  uploadFiles(files: File[]): Observable<UploadFilesResponse> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    return this.httpClient.post<UploadFilesResponse>(`${this.baseUrl}/incidents/uploads`, formData);
  }
}
