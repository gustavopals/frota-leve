import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api';
import type {
  ChecklistExecutionFilters,
  ChecklistExecutionListResponse,
  ChecklistTemplateDeletionResponse,
  ChecklistTemplateFilters,
  ChecklistTemplateListResponse,
  ChecklistTemplatePayload,
  ChecklistTemplateRecord,
} from './checklists.types';

const DEFAULT_PAGE_SIZE = 100;

@Injectable({
  providedIn: 'root',
})
export class ChecklistsService {
  private readonly apiService = inject(ApiService);

  listTemplates(
    filters: ChecklistTemplateFilters = {},
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  ): Observable<ChecklistTemplateListResponse> {
    return this.apiService.get<ChecklistTemplateListResponse>('checklists/templates', {
      params: {
        ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
        ...(filters.vehicleCategory ? { vehicleCategory: filters.vehicleCategory } : {}),
        page,
        pageSize,
        sortBy: 'name',
        sortOrder: 'asc',
      },
    });
  }

  getTemplateById(templateId: string): Observable<ChecklistTemplateRecord> {
    return this.apiService.get<ChecklistTemplateRecord>(`checklists/templates/${templateId}`);
  }

  listExecutions(
    filters: ChecklistExecutionFilters = {},
    page = 1,
    pageSize = 20,
  ): Observable<ChecklistExecutionListResponse> {
    return this.apiService.get<ChecklistExecutionListResponse>('checklists/executions', {
      params: {
        ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
        ...(filters.driverId ? { driverId: filters.driverId } : {}),
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        page,
        pageSize,
      },
    });
  }

  createTemplate(payload: ChecklistTemplatePayload): Observable<ChecklistTemplateRecord> {
    return this.apiService.post<ChecklistTemplateRecord, ChecklistTemplatePayload>(
      'checklists/templates',
      payload,
    );
  }

  replaceTemplate(
    templateId: string,
    payload: ChecklistTemplatePayload,
  ): Observable<ChecklistTemplateRecord> {
    return this.apiService.put<ChecklistTemplateRecord, ChecklistTemplatePayload>(
      `checklists/templates/${templateId}`,
      payload,
    );
  }

  deleteTemplate(templateId: string): Observable<ChecklistTemplateDeletionResponse> {
    return this.apiService.delete<ChecklistTemplateDeletionResponse>(
      `checklists/templates/${templateId}`,
    );
  }
}
