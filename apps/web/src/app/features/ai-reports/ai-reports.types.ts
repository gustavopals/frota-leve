export type ReportKind = 'MONTHLY' | 'ON_DEMAND';
export type ReportStatus = 'PENDING' | 'GENERATED' | 'FAILED';

export interface ReportListItem {
  id: string;
  period: string;
  kind: ReportKind;
  summary: string;
  status: ReportStatus;
  generatedAt: string | null;
  createdAt: string;
}

export interface ReportDetail extends ReportListItem {
  content: string;
  dataSnapshot: Record<string, unknown>;
}

export interface ReportListResponse {
  success: true;
  data: ReportListItem[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
