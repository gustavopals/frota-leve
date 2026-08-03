import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api';
import type { DriverRankingResponse, DriverScoreRecord } from './ai-scoring.types';

@Injectable({ providedIn: 'root' })
export class AiScoringService {
  private readonly api = inject(ApiService);

  getDriverHistory(driverId: string): Observable<{ success: true; data: DriverScoreRecord[] }> {
    return this.api.get<{ success: true; data: DriverScoreRecord[] }>(
      `/ai/scoring/drivers/${driverId}`,
    );
  }

  getRanking(page = 1, limit = 20): Observable<DriverRankingResponse> {
    return this.api.get<DriverRankingResponse>('/ai/scoring/ranking', {
      params: { page: String(page), limit: String(limit) },
    });
  }
}
