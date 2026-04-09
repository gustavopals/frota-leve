import {
  DocumentStatus,
  FineStatus,
  NotificationType,
  UserRole,
  type Prisma,
} from '@frota-leve/database';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { refreshDocumentStatuses } from '../documents/documents.alerts';
import {
  notificationEmailService,
  type CriticalNotificationEmailAlert,
  type CriticalNotificationEmailRecipient,
} from './notification-email.service';

const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAINTENANCE_ALERT_DAYS = 30;
const MAINTENANCE_ALERT_KM = 1000;
const CNH_ALERT_DAYS = 30;
const FINE_APPEAL_ALERT_DAYS = 7;

const NOTIFICATION_ALERT_SCHEDULER_USER_AGENT = 'notification-alert-scheduler';
const MAINTENANCE_PLAN_ENTITY = 'MaintenancePlan';
const DOCUMENT_ENTITY = 'Document';
const DRIVER_ENTITY = 'Driver';
const FINE_ENTITY = 'Fine';

const BACKOFFICE_NOTIFICATION_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.FINANCIAL,
] as const;

type NotificationRecipient = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  tenant: {
    name: string;
    tradeName: string | null;
  };
};

type MaintenancePlanCandidate = {
  id: string;
  tenantId: string;
  name: string;
  nextDueAt: Date | null;
  nextDueMileage: number | null;
  vehicle: {
    id: string;
    plate: string;
    currentMileage: number;
  };
};

type DocumentCandidate = {
  id: string;
  tenantId: string;
  type: string;
  description: string;
  expirationDate: Date;
  alertDaysBefore: number;
  status: DocumentStatus;
  vehicle: {
    id: string;
    plate: string;
  } | null;
  driver: {
    id: string;
    name: string;
  } | null;
};

type DriverCandidate = {
  id: string;
  tenantId: string;
  name: string;
  cnhCategory: string | null;
  cnhExpiration: Date | null;
};

type FineCandidate = {
  id: string;
  tenantId: string;
  autoNumber: string;
  dueDate: Date;
  vehicle: {
    id: string;
    plate: string;
  };
};

type ExistingNotificationRecord = {
  userId: string;
  entityType: string;
  entityId: string;
  title: string;
};

type NotificationCandidate = {
  tenantId: string;
  entityType: string;
  entityId: string;
  title: string;
  message: string;
  type: NotificationType;
};

type CriticalEmailBatch = {
  recipient: CriticalNotificationEmailRecipient;
  alerts: CriticalNotificationEmailAlert[];
};

type NotificationAlertPrismaClient = {
  user: {
    findMany(args: unknown): Promise<NotificationRecipient[]>;
  };
  maintenancePlan: {
    findMany(args: unknown): Promise<MaintenancePlanCandidate[]>;
  };
  document: {
    findMany(args: unknown): Promise<DocumentCandidate[]>;
  };
  driver: {
    findMany(args: unknown): Promise<DriverCandidate[]>;
  };
  fine: {
    findMany(args: unknown): Promise<FineCandidate[]>;
  };
  notification: {
    findMany(args: unknown): Promise<ExistingNotificationRecord[]>;
    create(args: unknown): Promise<unknown>;
  };
  $executeRaw(query: Prisma.Sql): Promise<unknown>;
};

const notificationAlertsPrisma = prisma as unknown as NotificationAlertPrismaClient;

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function addDays(date: Date, days: number): Date {
  const result = startOfDay(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function getMaintenanceReasons(plan: MaintenancePlanCandidate, referenceDate: Date): string[] {
  const reasons: string[] = [];

  if (plan.nextDueAt && plan.nextDueAt.getTime() <= referenceDate.getTime()) {
    reasons.push('date');
  }

  if (
    plan.nextDueMileage !== null &&
    plan.nextDueMileage !== undefined &&
    plan.vehicle.currentMileage >= plan.nextDueMileage
  ) {
    reasons.push('mileage');
  }

  return reasons;
}

function getUpcomingMaintenanceReasons(
  plan: MaintenancePlanCandidate,
  referenceDate: Date,
): string[] {
  if (getMaintenanceReasons(plan, referenceDate).length > 0) {
    return [];
  }

  const reasons: string[] = [];
  const thresholdDate = addDays(referenceDate, MAINTENANCE_ALERT_DAYS);

  if (plan.nextDueAt && plan.nextDueAt.getTime() <= thresholdDate.getTime()) {
    reasons.push('date');
  }

  if (
    plan.nextDueMileage !== null &&
    plan.nextDueMileage !== undefined &&
    plan.nextDueMileage - plan.vehicle.currentMileage <= MAINTENANCE_ALERT_KM
  ) {
    reasons.push('mileage');
  }

  return reasons;
}

function buildMaintenanceNotification(
  plan: MaintenancePlanCandidate,
  reasons: string[],
  overdue: boolean,
): NotificationCandidate {
  const reasonText = reasons
    .map((reason) => (reason === 'date' ? 'data' : 'quilometragem'))
    .join(' e ');

  return {
    tenantId: plan.tenantId,
    entityType: MAINTENANCE_PLAN_ENTITY,
    entityId: plan.id,
    title: overdue ? 'Plano de manutenção vencido' : 'Plano de manutenção próximo do vencimento',
    message: overdue
      ? `O plano "${plan.name}" do veículo ${plan.vehicle.plate} está vencido por ${reasonText}.`
      : `O plano "${plan.name}" do veículo ${plan.vehicle.plate} vence em breve por ${reasonText}.`,
    type: overdue ? NotificationType.CRITICAL : NotificationType.WARNING,
  };
}

function buildDocumentNotification(document: DocumentCandidate): NotificationCandidate {
  const target = document.vehicle
    ? `veículo ${document.vehicle.plate}`
    : document.driver
      ? `motorista ${document.driver.name}`
      : 'registro associado';

  return {
    tenantId: document.tenantId,
    entityType: DOCUMENT_ENTITY,
    entityId: document.id,
    title:
      document.status === DocumentStatus.EXPIRED ? 'Documento expirado' : 'Documento expirando',
    message: `O documento ${document.type} (${document.description}) do ${target} vence em ${formatDate(document.expirationDate)}.`,
    type:
      document.status === DocumentStatus.EXPIRED
        ? NotificationType.CRITICAL
        : NotificationType.WARNING,
  };
}

function buildDriverNotification(
  driver: DriverCandidate & { cnhExpiration: Date },
  referenceDate: Date,
): NotificationCandidate {
  const expired = (driver.cnhExpiration?.getTime() ?? 0) < startOfDay(referenceDate).getTime();
  const suffix = driver.cnhCategory ? ` Categoria ${driver.cnhCategory}.` : '';

  return {
    tenantId: driver.tenantId,
    entityType: DRIVER_ENTITY,
    entityId: driver.id,
    title: expired ? 'CNH vencida' : 'CNH próxima do vencimento',
    message: `A CNH de ${driver.name} vence em ${formatDate(driver.cnhExpiration)}.${suffix}`,
    type: expired ? NotificationType.CRITICAL : NotificationType.WARNING,
  };
}

function buildFineNotification(fine: FineCandidate): NotificationCandidate {
  return {
    tenantId: fine.tenantId,
    entityType: FINE_ENTITY,
    entityId: fine.id,
    title: 'Prazo de recurso da multa próximo',
    message: `A multa ${fine.autoNumber} do veículo ${fine.vehicle.plate} tem prazo de recurso até ${formatDate(fine.dueDate)}.`,
    type: NotificationType.WARNING,
  };
}

function toNotificationKey(
  userId: string,
  candidate: Pick<NotificationCandidate, 'entityType' | 'entityId' | 'title'>,
): string {
  return `${userId}:${candidate.entityType}:${candidate.entityId}:${candidate.title}`;
}

function getTenantDisplayName(recipient: NotificationRecipient): string {
  const tradeName = recipient.tenant.tradeName?.trim();
  return tradeName && tradeName.length > 0 ? tradeName : recipient.tenant.name;
}

function isCriticalEmailCandidate(candidate: NotificationCandidate): boolean {
  return (
    candidate.type === NotificationType.CRITICAL &&
    (candidate.entityType === MAINTENANCE_PLAN_ENTITY || candidate.entityType === DOCUMENT_ENTITY)
  );
}

function toCriticalEmailAlert(candidate: NotificationCandidate): CriticalNotificationEmailAlert {
  const baseUrl = env.FRONTEND_URL.replace(/\/+$/, '');

  if (candidate.entityType === MAINTENANCE_PLAN_ENTITY) {
    return {
      title: candidate.title,
      message: candidate.message,
      actionUrl: `${baseUrl}/maintenance`,
      actionLabel: 'Abrir manutenção',
    };
  }

  return {
    title: candidate.title,
    message: candidate.message,
    actionUrl: `${baseUrl}/documents`,
    actionLabel: 'Abrir documentos',
  };
}

export class NotificationAlertScheduler {
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  start(): void {
    if (env.NODE_ENV === 'test' || this.interval) {
      return;
    }

    logger.info('Scheduler de notificações iniciado.');
    void this.runSafely();

    this.interval = setInterval(() => {
      void this.runSafely();
    }, DAILY_INTERVAL_MS);

    this.interval.unref();
  }

  stop(): void {
    if (!this.interval) {
      return;
    }

    clearInterval(this.interval);
    this.interval = null;
  }

  async run(referenceDate: Date = new Date()): Promise<number> {
    if (this.running) {
      logger.warn(
        'Execução do scheduler de notificações ignorada porque outra já está em andamento.',
      );
      return 0;
    }

    this.running = true;

    try {
      const recipients = await notificationAlertsPrisma.user.findMany({
        where: {
          isActive: true,
          role: {
            in: [...BACKOFFICE_NOTIFICATION_ROLES],
          },
        },
        select: {
          id: true,
          tenantId: true,
          name: true,
          email: true,
          tenant: {
            select: {
              name: true,
              tradeName: true,
            },
          },
        },
      });

      if (recipients.length === 0) {
        return 0;
      }

      await refreshDocumentStatuses(notificationAlertsPrisma);

      const [maintenancePlans, documents, drivers, fines] = await Promise.all([
        notificationAlertsPrisma.maintenancePlan.findMany({
          where: {
            isActive: true,
            OR: [{ nextDueAt: { not: null } }, { nextDueMileage: { not: null } }],
          },
          select: {
            id: true,
            tenantId: true,
            name: true,
            nextDueAt: true,
            nextDueMileage: true,
            vehicle: {
              select: {
                id: true,
                plate: true,
                currentMileage: true,
              },
            },
          },
        }),
        notificationAlertsPrisma.document.findMany({
          where: {
            status: {
              in: [DocumentStatus.EXPIRING, DocumentStatus.EXPIRED],
            },
          },
          select: {
            id: true,
            tenantId: true,
            type: true,
            description: true,
            expirationDate: true,
            alertDaysBefore: true,
            status: true,
            vehicle: {
              select: {
                id: true,
                plate: true,
              },
            },
            driver: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        notificationAlertsPrisma.driver.findMany({
          where: {
            isActive: true,
            cnhExpiration: {
              not: null,
              lte: addDays(referenceDate, CNH_ALERT_DAYS),
            },
          },
          select: {
            id: true,
            tenantId: true,
            name: true,
            cnhCategory: true,
            cnhExpiration: true,
          },
        }),
        notificationAlertsPrisma.fine.findMany({
          where: {
            status: {
              in: [FineStatus.PENDING, FineStatus.DRIVER_IDENTIFIED],
            },
            dueDate: {
              gte: startOfDay(referenceDate),
              lte: addDays(referenceDate, FINE_APPEAL_ALERT_DAYS),
            },
          },
          select: {
            id: true,
            tenantId: true,
            autoNumber: true,
            dueDate: true,
            vehicle: {
              select: {
                id: true,
                plate: true,
              },
            },
          },
        }),
      ]);

      const maintenanceNotifications = maintenancePlans.flatMap((plan) => {
        const overdueReasons = getMaintenanceReasons(plan, referenceDate);
        if (overdueReasons.length > 0) {
          return [buildMaintenanceNotification(plan, overdueReasons, true)];
        }

        const upcomingReasons = getUpcomingMaintenanceReasons(plan, referenceDate);
        return upcomingReasons.length > 0
          ? [buildMaintenanceNotification(plan, upcomingReasons, false)]
          : [];
      });

      const documentNotifications = documents.map(buildDocumentNotification);
      const driverNotifications = drivers
        .filter((driver): driver is DriverCandidate & { cnhExpiration: Date } =>
          Boolean(driver.cnhExpiration),
        )
        .map((driver) => buildDriverNotification(driver, referenceDate));
      const fineNotifications = fines.map(buildFineNotification);

      const candidates = [
        ...maintenanceNotifications,
        ...documentNotifications,
        ...driverNotifications,
        ...fineNotifications,
      ];

      if (candidates.length === 0) {
        return 0;
      }

      const recipientIds = recipients.map((recipient) => recipient.id);
      const existingNotifications = await notificationAlertsPrisma.notification.findMany({
        where: {
          userId: {
            in: recipientIds,
          },
          entityType: {
            in: [MAINTENANCE_PLAN_ENTITY, DOCUMENT_ENTITY, DRIVER_ENTITY, FINE_ENTITY],
          },
          createdAt: {
            gte: startOfDay(referenceDate),
          },
        },
        select: {
          userId: true,
          entityType: true,
          entityId: true,
          title: true,
        },
      });

      const existingKeys = new Set(
        existingNotifications.map((item) => toNotificationKey(item.userId, item)),
      );
      const recipientsByTenant = recipients.reduce<Map<string, NotificationRecipient[]>>(
        (map, user) => {
          const list = map.get(user.tenantId) ?? [];
          list.push(user);
          map.set(user.tenantId, list);
          return map;
        },
        new Map(),
      );

      const creations: Array<Promise<unknown>> = [];
      const criticalEmailBatches = new Map<string, CriticalEmailBatch>();
      let createdCount = 0;

      for (const candidate of candidates) {
        const tenantRecipients = recipientsByTenant.get(candidate.tenantId) ?? [];

        for (const recipient of tenantRecipients) {
          const key = toNotificationKey(recipient.id, candidate);

          if (existingKeys.has(key)) {
            continue;
          }

          existingKeys.add(key);
          createdCount++;
          creations.push(
            notificationAlertsPrisma.notification.create({
              data: {
                tenantId: candidate.tenantId,
                userId: recipient.id,
                type: candidate.type,
                title: candidate.title,
                message: candidate.message,
                entityType: candidate.entityType,
                entityId: candidate.entityId,
              },
            }),
          );

          if (isCriticalEmailCandidate(candidate)) {
            const batch = criticalEmailBatches.get(recipient.id) ?? {
              recipient: {
                id: recipient.id,
                name: recipient.name,
                email: recipient.email,
                companyName: getTenantDisplayName(recipient),
              },
              alerts: [],
            };
            batch.alerts.push(toCriticalEmailAlert(candidate));
            criticalEmailBatches.set(recipient.id, batch);
          }
        }
      }

      await Promise.all(creations);
      await this.sendCriticalEmails(Array.from(criticalEmailBatches.values()), referenceDate);

      if (createdCount > 0) {
        logger.info('Notificações automáticas geradas.', {
          createdCount,
          referenceDate: referenceDate.toISOString(),
          userAgent: NOTIFICATION_ALERT_SCHEDULER_USER_AGENT,
        });
      }

      return createdCount;
    } finally {
      this.running = false;
    }
  }

  private async runSafely(referenceDate: Date = new Date()): Promise<void> {
    try {
      await this.run(referenceDate);
    } catch (error) {
      logger.error('Falha ao executar scheduler de notificações.', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async sendCriticalEmails(
    batches: CriticalEmailBatch[],
    referenceDate: Date,
  ): Promise<void> {
    if (batches.length === 0) {
      return;
    }

    const results = await Promise.allSettled(
      batches.map((batch) =>
        notificationEmailService.sendCriticalAlertDigest({
          recipient: batch.recipient,
          alerts: batch.alerts,
          referenceDate,
        }),
      ),
    );

    let sentCount = 0;

    results.forEach((result, index) => {
      const batch = batches[index];

      if (result.status === 'fulfilled') {
        sentCount += 1;
        return;
      }

      logger.error('Falha ao enviar e-mail de alerta crítico.', {
        userId: batch?.recipient.id,
        email: batch?.recipient.email,
        alertCount: batch?.alerts.length ?? 0,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    });

    if (sentCount > 0) {
      logger.info('E-mails de alertas críticos processados.', {
        recipientCount: sentCount,
        referenceDate: referenceDate.toISOString(),
      });
    }
  }
}

export const notificationAlertScheduler = new NotificationAlertScheduler();
export { NOTIFICATION_ALERT_SCHEDULER_USER_AGENT };
