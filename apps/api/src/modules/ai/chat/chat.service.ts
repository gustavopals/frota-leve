import {
  AIChatMessageRole,
  type AIChatMessage,
  type AIChatSession,
  type Prisma,
} from '@frota-leve/database';
import {
  AI_MODEL_SONNET,
  assistantService,
  buildFleetCatalogContext,
  buildAssistantSystemPrompt,
  type AssistantStreamEvent,
} from '@frota-leve/ai';
import { prisma } from '../../../config/database';
import { ConflictError, NotFoundError } from '../../../shared/errors';
import { executeAssistantTool, getAssistantToolDefinitions } from '../tools';

export interface ChatActorContext {
  tenantId: string;
  tenantName: string;
  userId: string;
}

const HISTORY_LIMIT = 10;

type ChatSessionPage = {
  data: AIChatSession[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export class ChatService {
  async createSession(ctx: ChatActorContext, input: { title?: string }): Promise<AIChatSession> {
    const title = input.title?.trim() || 'Nova conversa';

    return prisma.aIChatSession.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        title,
      },
    });
  }

  async listSessions(
    ctx: ChatActorContext,
    opts: { page: number; limit: number; includeArchived: boolean },
  ): Promise<ChatSessionPage> {
    const where = {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      ...(opts.includeArchived ? {} : { archivedAt: null }),
    };

    const [total, data] = await Promise.all([
      prisma.aIChatSession.count({ where }),
      prisma.aIChatSession.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (opts.page - 1) * opts.limit,
        take: opts.limit,
      }),
    ]);

    return {
      data,
      meta: {
        page: opts.page,
        limit: opts.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / opts.limit)),
      },
    };
  }

  async getSession(ctx: ChatActorContext, sessionId: string): Promise<AIChatSession> {
    const session = await prisma.aIChatSession.findFirst({
      where: { id: sessionId, tenantId: ctx.tenantId, userId: ctx.userId },
    });
    if (!session) {
      throw new NotFoundError('Sessão de chat não encontrada');
    }
    return session;
  }

  async getSessionMessages(ctx: ChatActorContext, sessionId: string): Promise<AIChatMessage[]> {
    await this.getSession(ctx, sessionId);
    return prisma.aIChatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async archiveSession(ctx: ChatActorContext, sessionId: string): Promise<void> {
    const session = await this.getSession(ctx, sessionId);
    if (session.archivedAt) {
      throw new ConflictError('Sessão já está arquivada');
    }
    await prisma.aIChatSession.update({
      where: { id: sessionId },
      data: { archivedAt: new Date() },
    });
  }

  /**
   * Envia uma mensagem do usuário e retorna o stream de eventos do assistente.
   * Persiste a mensagem do usuário antes do stream e a mensagem do assistente ao final.
   */
  async *sendMessage(
    ctx: ChatActorContext,
    sessionId: string,
    content: string,
  ): AsyncGenerator<AssistantStreamEvent & { messageId?: string }> {
    const session = await this.getSession(ctx, sessionId);
    if (session.archivedAt) {
      throw new ConflictError('Sessão arquivada não pode receber novas mensagens');
    }

    // Persiste mensagem do usuário
    await prisma.aIChatMessage.create({
      data: {
        sessionId,
        role: AIChatMessageRole.USER,
        content: { text: content } as Prisma.InputJsonValue,
      },
    });

    // Carrega histórico (últimas 10 mensagens, ordenadas asc) — exclui a recém-criada
    const recent = await prisma.aIChatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT + 1,
    });
    const history = recent
      .slice(1) // remove a mensagem do usuário recém-criada
      .reverse()
      .filter((m) => m.role === AIChatMessageRole.USER || m.role === AIChatMessageRole.ASSISTANT)
      .map((m) => ({
        role: m.role === AIChatMessageRole.USER ? ('user' as const) : ('assistant' as const),
        content:
          typeof m.content === 'object' && m.content && 'text' in m.content
            ? String((m.content as { text: unknown }).text)
            : String(m.content ?? ''),
      }));

    const today = new Date().toISOString().slice(0, 10);
    const systemPrompt = buildAssistantSystemPrompt({ tenantName: ctx.tenantName, today });
    const fleetContext = await buildFleetCatalogContext(ctx.tenantId);

    const stream = assistantService.streamTurn({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      model: AI_MODEL_SONNET,
      systemPrompt,
      history,
      userMessage: content,
      contextBlock: {
        content: `Contexto compacto da frota do tenant (cacheável):\n${fleetContext}`,
        cacheable: true,
      },
      tools: getAssistantToolDefinitions(),
      toolExecutor: (name, input) =>
        executeAssistantTool(name, input, { tenantId: ctx.tenantId, userId: ctx.userId }),
    });

    let finalText = '';

    for await (const event of stream) {
      if (event.type === 'delta') {
        finalText += event.text;
      }
      if (event.type === 'done') {
        const message = await prisma.aIChatMessage.create({
          data: {
            sessionId,
            role: AIChatMessageRole.ASSISTANT,
            content: { text: event.finalText || finalText } as Prisma.InputJsonValue,
            tokensIn: event.usage.inputTokens ?? null,
            tokensOut: event.usage.outputTokens ?? null,
            model: AI_MODEL_SONNET,
          },
        });

        // Atualiza updatedAt da sessão para subir no ranking
        await prisma.aIChatSession.update({
          where: { id: sessionId },
          data: { updatedAt: new Date() },
        });

        yield { ...event, messageId: message.id };
        continue;
      }

      yield event;
    }
  }
}

export const chatService = new ChatService();
