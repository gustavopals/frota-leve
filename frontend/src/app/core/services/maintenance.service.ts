import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Maintenance, MaintenancePlan, UpcomingMaintenance, MaintenanceStats } from '../models/maintenance.model';

@Injectable({
  providedIn: 'root'
})
export class MaintenanceService {
  private readonly API_URL = `${environment.apiUrl}/maintenance`;

  constructor(private http: HttpClient) {}

  // ==================== MAINTENANCE PLANS ====================

  createPlan(data: Partial<MaintenancePlan>): Observable<MaintenancePlan> {
    return this.http.post<MaintenancePlan>(`${this.API_URL}/plans`, data);
  }

  getPlans(): Observable<MaintenancePlan[]> {
    return this.http.get<MaintenancePlan[]>(`${this.API_URL}/plans`);
  }

  getPlan(id: string): Observable<MaintenancePlan> {
    return this.http.get<MaintenancePlan>(`${this.API_URL}/plans/${id}`);
  }

  updatePlan(id: string, data: Partial<MaintenancePlan>): Observable<MaintenancePlan> {
    return this.http.patch<MaintenancePlan>(`${this.API_URL}/plans/${id}`, data);
  }

  deletePlan(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/plans/${id}`);
  }

  // ==================== MAINTENANCES ====================

  create(data: Partial<Maintenance>): Observable<Maintenance> {
    return this.http.post<Maintenance>(this.API_URL, data);
  }

  getAll(vehicleId?: string): Observable<Maintenance[]> {
    let params = new HttpParams();
    if (vehicleId) {
      params = params.set('vehicleId', vehicleId);
    }
    return this.http.get<Maintenance[]>(this.API_URL, { params });
  }

  getOne(id: string): Observable<Maintenance> {
    return this.http.get<Maintenance>(`${this.API_URL}/${id}`);
  }

  update(id: string, data: Partial<Maintenance>): Observable<Maintenance> {
    return this.http.patch<Maintenance>(`${this.API_URL}/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

  getUpcoming(): Observable<UpcomingMaintenance[]> {
    return this.http.get<UpcomingMaintenance[]>(`${this.API_URL}/upcoming`);
  }

  getStats(): Observable<MaintenanceStats> {
    return this.http.get<MaintenanceStats>(`${this.API_URL}/stats`);
  }
}
