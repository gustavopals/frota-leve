import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/services/api';
import { AuthService } from '../../core/services/auth';
import {
  type ChatMessage,
  type ChatSession,
  type ListSessionsResponse,
  type StreamEvent,
} from './ai-assistant.types';

@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  listSessions(includeArchived = false): Promise<ListSessionsResponse> {
    return firstValueFrom(
      this.api.get<ListSessionsResponse>('/ai/chat/sessions', {
        params: { page: 1, limit: 50, includeArchived: String(includeArchived) },
      }),
    );
  }

  createSession(title?: string): Promise<{ success: true; data: ChatSession }> {
    return firstValueFrom(
      this.api.post<{ success: true; data: ChatSession }>('/ai/chat/sessions', { title }),
    );
  }

  archiveSession(id: string): Promise<void> {
    return firstValueFrom(this.api.delete<void>(`/ai/chat/sessions/${id}`));
  }

  getMessages(sessionId: string): Promise<{ success: true; data: ChatMessage[] }> {
    return firstValueFrom(
      this.api.get<{ success: true; data: ChatMessage[] }>(
        `/ai/chat/sessions/${sessionId}/messages`,
      ),
    );
  }

  /**
   * Envia uma mensagem via fetch + ReadableStream (SSE), parseando os eventos.
   * Usa fetch direto para receber stream — o `HttpClient` do Angular não expõe
   * o body como ReadableStream de forma simples.
   */
  async *streamMessage(sessionId: string, content: string): AsyncGenerator<StreamEvent> {
    const token = this.auth.getAccessToken();
    const tenantId = this.auth.getCurrentTenant()?.id;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (tenantId) headers['X-Tenant-Id'] = tenantId;

    const url = `${environment.apiUrl.replace(/\/+$/, '')}/ai/chat/sessions/${sessionId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content }),
    });

    if (!response.ok || !response.body) {
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        // ignora
      }
      yield {
        type: 'error',
        message:
          typeof payload === 'object' && payload && 'error' in payload
            ? String((payload as { error?: { message?: string } }).error?.message ?? 'Falha')
            : `HTTP ${response.status}`,
        code:
          typeof payload === 'object' && payload && 'error' in payload
            ? (payload as { error?: { code?: string } }).error?.code
            : undefined,
      };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIndex: number;
        while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);

          const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data: '));
          if (!dataLine) continue;

          try {
            const parsed = JSON.parse(dataLine.slice(6)) as StreamEvent;
            yield parsed;
          } catch {
            // ignora linha malformada
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
