import type { NextFunction, Request, Response } from 'express';
import { logger } from '../../../config/logger';
import { UnauthorizedError } from '../../../shared/errors';
import { chatService, type ChatActorContext } from './chat.service';
import type {
  CreateSessionInput,
  ListSessionsQueryInput,
  SendMessageInput,
  SessionIdParams,
} from './chat.validators';

function writeSseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export class ChatController {
  private getActorContext(req: Request): ChatActorContext {
    if (!req.tenant) throw new UnauthorizedError('Tenant não identificado');
    if (!req.user?.id) throw new UnauthorizedError('Usuário não autenticado');

    return {
      tenantId: req.tenant.id,
      tenantName: req.tenant.name,
      userId: req.user.id,
    };
  }

  createSession = (req: Request, res: Response, next: NextFunction): void => {
    const ctx = this.getActorContext(req);
    void chatService
      .createSession(ctx, req.body as CreateSessionInput)
      .then((session) => res.status(201).json({ success: true, data: session }))
      .catch(next);
  };

  listSessions = (req: Request, res: Response, next: NextFunction): void => {
    const ctx = this.getActorContext(req);
    const query = req.query as unknown as ListSessionsQueryInput;
    void chatService
      .listSessions(ctx, query)
      .then((result) => res.status(200).json({ success: true, ...result }))
      .catch(next);
  };

  getSessionMessages = (req: Request, res: Response, next: NextFunction): void => {
    const ctx = this.getActorContext(req);
    const { id } = req.params as SessionIdParams;
    void chatService
      .getSessionMessages(ctx, id)
      .then((data) => res.status(200).json({ success: true, data }))
      .catch(next);
  };

  archiveSession = (req: Request, res: Response, next: NextFunction): void => {
    const ctx = this.getActorContext(req);
    const { id } = req.params as SessionIdParams;
    void chatService
      .archiveSession(ctx, id)
      .then(() => res.status(204).send())
      .catch(next);
  };

  /**
   * Endpoint SSE: POST .../messages
   * Stream de eventos: `delta`, `tool_use`, `tool_result`, `done`, `error`.
   */
  sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let ctx: ChatActorContext;
    try {
      ctx = this.getActorContext(req);
    } catch (error) {
      next(error);
      return;
    }

    const { id: sessionId } = req.params as SessionIdParams;
    const { content } = req.body as SendMessageInput;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let clientDisconnected = false;
    req.on('aborted', () => {
      clientDisconnected = true;
    });
    res.on('close', () => {
      if (!res.writableEnded) {
        clientDisconnected = true;
      }
    });

    try {
      const stream = chatService.sendMessage(ctx, sessionId, content);

      for await (const event of stream) {
        if (clientDisconnected) {
          break;
        }
        writeSseEvent(res, event.type, event);
      }
    } catch (error) {
      logger.error('Erro no stream do assistente IA', {
        error: error instanceof Error ? error.message : String(error),
        sessionId,
        tenantId: ctx.tenantId,
      });
      writeSseEvent(res, 'error', {
        type: 'error',
        message: error instanceof Error ? error.message : 'Erro ao processar mensagem',
      });
    } finally {
      res.end();
    }
  };
}
