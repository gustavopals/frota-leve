import type { NavigationExtras } from '@angular/router';
import type { NotificationRecord } from './notifications.types';

export type ResolvedNotificationTarget = {
  commands: string[];
  extras?: NavigationExtras;
};

export function resolveNotificationTarget(
  notification: NotificationRecord,
): ResolvedNotificationTarget | null {
  switch (notification.entityType) {
    case 'Document':
      return {
        commands: ['/documents', notification.entityId, 'edit'],
      };

    case 'Driver':
      return {
        commands: ['/drivers', notification.entityId],
      };

    case 'ServiceOrder':
      return {
        commands: ['/maintenance/service-orders', notification.entityId, 'edit'],
      };

    case 'MaintenancePlan':
      return {
        commands: ['/maintenance'],
        extras: {
          queryParams: {
            planId: notification.entityId,
          },
          fragment: 'plans',
        },
      };

    case 'Fine':
      return {
        commands: ['/fines'],
        extras: {
          queryParams: {
            fineId: notification.entityId,
          },
        },
      };

    default:
      return null;
  }
}
