export interface ChatSession {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'USER' | 'ASSISTANT' | 'TOOL';
  content: { text?: string } | string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  model?: string | null;
  createdAt: string;
}

export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool_use'; name: string; input: unknown }
  | { type: 'tool_result'; name: string; ok: boolean }
  | {
      type: 'done';
      finalText: string;
      messageId?: string;
      iterations: number;
      usage: { inputTokens?: number; outputTokens?: number };
    }
  | { type: 'error'; message: string; code?: string };

export interface ListSessionsResponse {
  success: true;
  data: ChatSession[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface SuggestionChip {
  label: string;
  prompt: string;
}

export const DEFAULT_SUGGESTIONS: SuggestionChip[] = [
  { label: 'Resumo do mês', prompt: 'Me dê um resumo do mês corrente da frota.' },
  {
    label: 'Top 5 veículos por custo',
    prompt: 'Quais são os 5 veículos com maior custo total no mês corrente?',
  },
  {
    label: 'Anomalias abertas',
    prompt: 'Liste as anomalias abertas detectadas pelo sistema.',
  },
  {
    label: 'Multas recentes',
    prompt: 'Resumo de multas dos últimos 30 dias por motorista.',
  },
];
