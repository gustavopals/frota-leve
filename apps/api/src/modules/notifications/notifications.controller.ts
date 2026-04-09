import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../shared/errors';
import { notificationService } from './notifications.service';
import type { NotificationActorContext } from './notifications.types';
import type { ListNotificationsQueryInput, NotificationIdParams } from './notifications.validators';

export class NotificationsController {
  private getActorContext(req: Request): NotificationActorContext {
    if (!req.tenant) {
      throw new UnauthorizedError('Tenant não identificado');
    }

    if (!req.user?.id) {
      throw new UnauthorizedError('Usuário não autenticado');
    }

    return {
      tenantId: req.tenant.id,
      userId: req.user.id,
    };
  }

  list = (req: Request, res: Response, next: NextFunction): void => {
    void notificationService
      .list(this.getActorContext(req), req.query as unknown as ListNotificationsQueryInput)
      .then((result) => res.status(200).json(result))
      .catch(next);
  };

  markAsRead = (req: Request, res: Response, next: NextFunction): void => {
    const context = this.getActorContext(req);

    void notificationService
      .markAsRead({
        tenantId: context.tenantId,
        userId: context.userId,
        notificationId: (req.params as NotificationIdParams).id,
      })
      .then((result) => res.status(200).json(result))
      .catch(next);
  };

  markAllAsRead = (req: Request, res: Response, next: NextFunction): void => {
    const context = this.getActorContext(req);

    void notificationService
      .markAllAsRead({
        tenantId: context.tenantId,
        userId: context.userId,
      })
      .then((result) => res.status(200).json(result))
      .catch(next);
  };
}
