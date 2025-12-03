import { Injectable, inject } from '@angular/core';
import { ApiService } from './api';
import { Observable } from 'rxjs';
import {
  ChecklistTemplate,
  ChecklistSubmission,
  ChecklistStats,
} from '../models/checklist.model';

@Injectable({
  providedIn: 'root',
})
export class ChecklistService {
  private api = inject(ApiService);
  private baseUrl = '/checklist';

  // ===== TEMPLATES =====

  createTemplate(data: Partial<ChecklistTemplate>): Observable<ChecklistTemplate> {
    return this.api.post<ChecklistTemplate>(`${this.baseUrl}/templates`, data);
  }

  findAllTemplates(): Observable<ChecklistTemplate[]> {
    return this.api.get<ChecklistTemplate[]>(`${this.baseUrl}/templates`);
  }

  findOneTemplate(id: string): Observable<ChecklistTemplate> {
    return this.api.get<ChecklistTemplate>(`${this.baseUrl}/templates/${id}`);
  }

  updateTemplate(id: string, data: Partial<ChecklistTemplate>): Observable<ChecklistTemplate> {
    return this.api.patch<ChecklistTemplate>(`${this.baseUrl}/templates/${id}`, data);
  }

  removeTemplate(id: string): Observable<void> {
    return this.api.delete<void>(`${this.baseUrl}/templates/${id}`);
  }

  // ===== SUBMISSIONS =====

  createSubmission(data: Partial<ChecklistSubmission>): Observable<ChecklistSubmission> {
    return this.api.post<ChecklistSubmission>(`${this.baseUrl}/submissions`, data);
  }

  findAllSubmissions(vehicleId?: string, driverId?: string): Observable<ChecklistSubmission[]> {
    const params: any = {};
    if (vehicleId) params.vehicleId = vehicleId;
    if (driverId) params.driverId = driverId;
    return this.api.get<ChecklistSubmission[]>(`${this.baseUrl}/submissions`, params);
  }

  findOneSubmission(id: string): Observable<ChecklistSubmission> {
    return this.api.get<ChecklistSubmission>(`${this.baseUrl}/submissions/${id}`);
  }

  getStats(): Observable<ChecklistStats> {
    return this.api.get<ChecklistStats>(`${this.baseUrl}/submissions/stats`);
  }
}
