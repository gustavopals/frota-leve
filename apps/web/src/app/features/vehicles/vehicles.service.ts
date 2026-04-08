import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api';
import { environment } from '../../../environments/environment';
import type {
  VehicleDeletionResponse,
  VehicleDetail,
  VehicleFormPayload,
  VehicleImportPreviewResponse,
  VehicleImportResponse,
  VehicleListFilters,
  VehicleListResponse,
  VehicleRecord,
  VehicleStatsResponse,
} from './vehicles.types';

@Injectable({
  providedIn: 'root',
})
export class VehiclesService {
  private readonly apiService = inject(ApiService);
  private readonly httpClient = inject(HttpClient);
  private readonly vehiclesBaseUrl = `${environment.apiUrl.replace(/\/+$/, '')}/vehicles`;

  getTableApiUrl(filters: VehicleListFilters, refreshToken = 0): string {
    const params = this.buildHttpParams({
      status: filters.status ?? undefined,
      category: filters.category ?? undefined,
      fuelType: filters.fuelType ?? undefined,
      search: filters.search?.trim() || undefined,
      refresh: refreshToken,
    });
    const query = params.toString();

    return query ? `${this.vehiclesBaseUrl}?${query}` : this.vehiclesBaseUrl;
  }

  list(filters: VehicleListFilters, page = 1, pageSize = 10): Observable<VehicleListResponse> {
    return this.apiService.get<VehicleListResponse>('vehicles', {
      params: {
        ...this.toQueryObject(filters),
        page,
        pageSize,
      },
    });
  }

  getById(vehicleId: string): Observable<VehicleDetail> {
    return this.apiService.get<VehicleDetail>(`vehicles/${vehicleId}`);
  }

  create(payload: VehicleFormPayload): Observable<VehicleRecord> {
    return this.apiService.post<VehicleRecord, VehicleFormPayload>('vehicles', payload);
  }

  update(vehicleId: string, payload: VehicleFormPayload): Observable<VehicleRecord> {
    return this.apiService.put<VehicleRecord, VehicleFormPayload>(`vehicles/${vehicleId}`, payload);
  }

  updateStatus(vehicleId: string, status: VehicleFormPayload['status']): Observable<VehicleRecord> {
    return this.apiService.patch<VehicleRecord, { status: VehicleFormPayload['status'] }>(
      `vehicles/${vehicleId}/status`,
      { status },
    );
  }

  updateMileage(vehicleId: string, mileage: number): Observable<VehicleRecord> {
    return this.apiService.patch<VehicleRecord, { mileage: number }>(
      `vehicles/${vehicleId}/mileage`,
      { mileage },
    );
  }

  delete(vehicleId: string): Observable<VehicleDeletionResponse> {
    return this.apiService.delete<VehicleDeletionResponse>(`vehicles/${vehicleId}`);
  }

  getStats(filters: VehicleListFilters): Observable<VehicleStatsResponse> {
    return this.apiService.get<VehicleStatsResponse>('vehicles/stats', {
      params: this.toQueryObject(filters),
    });
  }

  previewImport(file: File): Observable<VehicleImportPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.httpClient.post<VehicleImportPreviewResponse>(
      `${this.vehiclesBaseUrl}/import`,
      formData,
      {
        params: new HttpParams().set('preview', 'true'),
      },
    );
  }

  import(file: File): Observable<VehicleImportResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.httpClient.post<VehicleImportResponse>(`${this.vehiclesBaseUrl}/import`, formData, {
      params: new HttpParams().set('preview', 'false'),
    });
  }

  export(filters: VehicleListFilters): Observable<Blob> {
    return this.httpClient.get(`${this.vehiclesBaseUrl}/export`, {
      params: this.buildHttpParams(this.toQueryObject(filters)),
      responseType: 'blob',
    });
  }

  private toQueryObject(filters: VehicleListFilters): Record<string, string> {
    return {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.fuelType ? { fuelType: filters.fuelType } : {}),
      ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
    };
  }

  private buildHttpParams(
    params: Record<string, string | number | boolean | undefined>,
  ): HttpParams {
    let httpParams = new HttpParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      httpParams = httpParams.set(key, String(value));
    });

    return httpParams;
  }
}
