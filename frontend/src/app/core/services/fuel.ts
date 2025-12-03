import { Injectable, inject } from '@angular/core';
import { ApiService } from './api';
import { Observable } from 'rxjs';
import { FuelLog, FuelAnalytics, FuelStats } from '../models/fuel.model';

@Injectable({
  providedIn: 'root'
})
export class FuelService {
  private api = inject(ApiService);
  private baseUrl = '/fuel';

  create(data: Partial<FuelLog>): Observable<FuelLog> {
    return this.api.post<FuelLog>(this.baseUrl, data);
  }

  findAll(vehicleId?: string): Observable<FuelLog[]> {
    const params = vehicleId ? { vehicleId } : {};
    return this.api.get<FuelLog[]>(this.baseUrl, params);
  }

  findOne(id: string): Observable<FuelLog> {
    return this.api.get<FuelLog>(`${this.baseUrl}/${id}`);
  }

  update(id: string, data: Partial<FuelLog>): Observable<FuelLog> {
    return this.api.patch<FuelLog>(`${this.baseUrl}/${id}`, data);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`${this.baseUrl}/${id}`);
  }

  getAnalytics(vehicleId: string): Observable<FuelAnalytics> {
    return this.api.get<FuelAnalytics>(`${this.baseUrl}/analytics/${vehicleId}`);
  }

  getStats(): Observable<FuelStats> {
    return this.api.get<FuelStats>(`${this.baseUrl}/stats`);
  }
}
