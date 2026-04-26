import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PoButtonModule, PoLoadingModule, PoNotificationService } from '@po-ui/ng-components';
import { AuthService } from '../../../../core/services/auth';
import { AiMarkdownPipe } from '../../ai-markdown.pipe';
import { AiAssistantService } from '../../ai-assistant.service';
import {
  DEFAULT_SUGGESTIONS,
  type ChatMessage,
  type ChatSession,
  type SuggestionChip,
} from '../../ai-assistant.types';

interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  pending?: boolean;
  toolUses?: Array<{ name: string; ok?: boolean }>;
}

@Component({
  selector: 'app-ai-assistant-page',
  imports: [FormsModule, PoButtonModule, PoLoadingModule, AiMarkdownPipe],
  templateUrl: './ai-assistant-page.html',
  styleUrl: './ai-assistant-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAssistantPage {
  private readonly assistant = inject(AiAssistantService);
  private readonly auth = inject(AuthService);
  private readonly notification = inject(PoNotificationService);
  private readonly router = inject(Router);

  readonly suggestions: SuggestionChip[] = DEFAULT_SUGGESTIONS;
  readonly sessions = signal<ChatSession[]>([]);
  readonly currentSessionId = signal<string | null>(null);
  readonly messages = signal<UiMessage[]>([]);
  readonly draft = signal<string>('');
  readonly loadingSessions = signal<boolean>(true);
  readonly streaming = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly planBlocked = signal<boolean>(false);

  private readonly messagesEnd = viewChild<ElementRef<HTMLDivElement>>('messagesEnd');

  constructor() {
    void this.loadSessions();
  }

  isEssentialPlan(): boolean {
    const plan = this.auth.getCurrentTenant()?.plan;
    return plan === 'ESSENTIAL';
  }

  async loadSessions(): Promise<void> {
    this.loadingSessions.set(true);
    try {
      const result = await this.assistant.listSessions(false);
      this.sessions.set(result.data);
      if (result.data.length > 0 && !this.currentSessionId()) {
        await this.selectSession(result.data[0].id);
      }
    } catch (error) {
      this.handleError(error);
    } finally {
      this.loadingSessions.set(false);
    }
  }

  async newSession(): Promise<void> {
    try {
      const { data } = await this.assistant.createSession();
      this.sessions.update((list) => [data, ...list]);
      this.currentSessionId.set(data.id);
      this.messages.set([]);
      this.errorMessage.set(null);
    } catch (error) {
      this.handleError(error);
    }
  }

  async selectSession(sessionId: string): Promise<void> {
    this.currentSessionId.set(sessionId);
    this.errorMessage.set(null);
    try {
      const { data } = await this.assistant.getMessages(sessionId);
      this.messages.set(data.map(this.toUiMessage));
      this.scrollToBottom();
    } catch (error) {
      this.handleError(error);
    }
  }

  async archive(sessionId: string, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      await this.assistant.archiveSession(sessionId);
      this.sessions.update((list) => list.filter((s) => s.id !== sessionId));
      if (this.currentSessionId() === sessionId) {
        this.currentSessionId.set(null);
        this.messages.set([]);
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  applySuggestion(suggestion: SuggestionChip): void {
    this.draft.set(suggestion.prompt);
  }

  async send(): Promise<void> {
    const text = this.draft().trim();
    if (!text || this.streaming()) return;

    let sessionId = this.currentSessionId();
    if (!sessionId) {
      try {
        const created = await this.assistant.createSession(text.slice(0, 60));
        sessionId = created.data.id;
        this.sessions.update((list) => [created.data, ...list]);
        this.currentSessionId.set(sessionId);
      } catch (error) {
        this.handleError(error);
        return;
      }
    }

    const userMsg: UiMessage = { id: `local-user-${Date.now()}`, role: 'user', text };
    const assistantMsg: UiMessage = {
      id: `local-asst-${Date.now()}`,
      role: 'assistant',
      text: '',
      pending: true,
      toolUses: [],
    };
    this.messages.update((list) => [...list, userMsg, assistantMsg]);
    this.draft.set('');
    this.streaming.set(true);
    this.errorMessage.set(null);
    this.scrollToBottom();

    try {
      for await (const event of this.assistant.streamMessage(sessionId, text)) {
        if (event.type === 'delta') {
          assistantMsg.text += event.text;
          this.refreshAssistantMessage(assistantMsg);
        } else if (event.type === 'tool_use') {
          assistantMsg.toolUses = [...(assistantMsg.toolUses ?? []), { name: event.name }];
          this.refreshAssistantMessage(assistantMsg);
        } else if (event.type === 'tool_result') {
          const tools = assistantMsg.toolUses ?? [];
          const target = tools.find((t) => t.name === event.name && t.ok === undefined);
          if (target) target.ok = event.ok;
          this.refreshAssistantMessage(assistantMsg);
        } else if (event.type === 'done') {
          assistantMsg.pending = false;
          if (event.finalText) assistantMsg.text = event.finalText;
          this.refreshAssistantMessage(assistantMsg);
        } else if (event.type === 'error') {
          assistantMsg.pending = false;
          assistantMsg.text =
            assistantMsg.text || `Erro: ${event.message}${event.code ? ` (${event.code})` : ''}`;
          this.errorMessage.set(event.message);
          if (event.code === 'PLAN_AI_REQUIRED') this.planBlocked.set(true);
          this.refreshAssistantMessage(assistantMsg);
        }
      }
    } catch (error) {
      assistantMsg.pending = false;
      this.handleError(error);
      this.refreshAssistantMessage(assistantMsg);
    } finally {
      this.streaming.set(false);
      this.scrollToBottom();
    }
  }

  goToBilling(): void {
    void this.router.navigate(['/settings']);
  }

  private refreshAssistantMessage(msg: UiMessage): void {
    this.messages.update((list) => list.map((m) => (m.id === msg.id ? { ...msg } : m)));
    this.scrollToBottom();
  }

  private toUiMessage = (m: ChatMessage): UiMessage => {
    const text =
      typeof m.content === 'object' && m.content && 'text' in m.content
        ? String(m.content.text ?? '')
        : String(m.content ?? '');
    return {
      id: m.id,
      role: m.role === 'USER' ? 'user' : 'assistant',
      text,
    };
  };

  private scrollToBottom(): void {
    queueMicrotask(() => {
      this.messagesEnd()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }

  private handleError(error: unknown): void {
    const httpError = error as {
      message?: string;
      status?: number;
      error?: { error?: { code?: string; message?: string } };
    };
    const message =
      httpError?.error?.error?.message ??
      (error instanceof Error ? error.message : 'Erro desconhecido');
    const code = httpError?.error?.error?.code;

    if (httpError?.status === 403 && code === 'PLAN_AI_REQUIRED') {
      this.planBlocked.set(true);
      return;
    }

    if (httpError?.status === 503 && code === 'AI_DISABLED') {
      this.errorMessage.set(message);
      return;
    }

    this.errorMessage.set(message);
    this.notification.error({ message });
  }
}
