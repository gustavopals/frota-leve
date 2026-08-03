export interface DriverScoreBreakdown {
  fuel: number;
  fines: number;
  incidents: number;
  checklist: number;
  vehicleCare: number;
}

export interface DriverScoreRecord {
  id: string;
  driverId: string;
  periodStart: string;
  periodEnd: string;
  score: number;
  breakdown: DriverScoreBreakdown;
  /** JSON serializado das recomendações; string vazia quando a IA não rodou. */
  recommendations: string;
}

export interface DriverRecommendation {
  strengths: string[];
  improvements: string[];
  actions: Array<{ kind: 'TRAINING' | 'BONUS' | 'WARNING' | 'NONE'; description: string }>;
}

export interface DriverRankingItem {
  id: string;
  name: string;
  score: number | null;
  department: string | null;
}

export interface DriverRankingResponse {
  success: true;
  data: DriverRankingItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
