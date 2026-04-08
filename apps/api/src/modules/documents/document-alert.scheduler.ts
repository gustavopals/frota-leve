import { DocumentStatus, type Prisma } from '@frota-leve/database';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import {
  DOCUMENT_ALERT_SCHEDULER_USER_AGENT,
  DOCUMENT_ENTITY,
  DOCUMENT_EXPIRED_ACTION,
  DOCUMENT_EXPIRING_ACTION,
  getDaysUntilExpiration,
  refreshDocumentStatuses,
  startOfDay,
} from './documents.alerts';

const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;

type DocumentAlertCandidate = {
  id: string;
  tenantId: string;
  vehicleId: string | null;
  driverId: string | null;
  type: string;
  description: string;
  expirationDate: Date;
  alertDaysBefore: number;
  status: DocumentStatus;
  vehicle: {
    id: string;
    plate: string;
    brand: string;
    model: string;
  } | null;
  driver: {
    id: string;
    name: string;
    cpf: string;
  } | null;
};

type ExistingAlertRecord = {
  entityId: string;
  action: string;
};

type DocumentAlertPrismaClient = {
  document: {
    findMany(args: unknown): Promise<DocumentAlertCandidate[]>;
  };
  auditLog: {
    findMany(args: unknown): Promise<ExistingAlertRecord[]>;
    create(args: unknown): Promise<unknown>;
  };
  $executeRaw(query: Prisma.Sql): Promise<unknown>;
};

const documentsPrisma = prisma as unknown as DocumentAlertPrismaClient;

function resolveAlertAction(status: DocumentStatus): string | null {
  switch (status) {
    case DocumentStatus.EXPIRED:
      return DOCUMENT_EXPIRED_ACTION;
    case DocumentStatus.EXPIRING:
      return DOCUMENT_EXPIRING_ACTION;
    default:
      return null;
  }
}

function toAuditChanges(
  document: DocumentAlertCandidate,
  referenceDate: Date,
): Prisma.InputJsonValue {
  return {
    documentType: document.type,
    documentDescription: document.description,
    expirationDate: document.expirationDate.toISOString(),
    alertDaysBefore: document.alertDaysBefore,
    status: document.status,
    daysUntilExpiration: getDaysUntilExpiration(document.expirationDate, referenceDate),
    generatedAt: referenceDate.toISOString(),
    vehicleId: document.vehicleId,
    vehiclePlate: document.vehicle?.plate ?? null,
    driverId: document.driverId,
    driverName: document.driver?.name ?? null,
  };
}

export class DocumentAlertScheduler {
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  start(): void {
    if (env.NODE_ENV === 'test' || this.interval) {
      return;
    }

    logger.info('Scheduler de documentos iniciado.');
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
        'Execução do scheduler de documentos ignorada porque outra já está em andamento.',
      );
      return 0;
    }

    this.running = true;

    try {
      await refreshDocumentStatuses(documentsPrisma);

      const documents = await documentsPrisma.document.findMany({
        where: {
          status: {
            in: [DocumentStatus.EXPIRING, DocumentStatus.EXPIRED],
          },
        },
        select: {
          id: true,
          tenantId: true,
          vehicleId: true,
          driverId: true,
          type: true,
          description: true,
          expirationDate: true,
          alertDaysBefore: true,
          status: true,
          vehicle: {
            select: {
              id: true,
              plate: true,
              brand: true,
              model: true,
            },
          },
          driver: {
            select: {
              id: true,
              name: true,
              cpf: true,
            },
          },
        },
      });

      const actionableDocuments = documents
        .map((document) => ({
          document,
          action: resolveAlertAction(document.status),
        }))
        .filter(
          (
            entry,
          ): entry is {
            document: DocumentAlertCandidate;
            action: string;
          } => Boolean(entry.action),
        );

      if (actionableDocuments.length === 0) {
        return 0;
      }

      const existingAlerts = await documentsPrisma.auditLog.findMany({
        where: {
          action: {
            in: [DOCUMENT_EXPIRING_ACTION, DOCUMENT_EXPIRED_ACTION],
          },
          entity: DOCUMENT_ENTITY,
          entityId: {
            in: actionableDocuments.map(({ document }) => document.id),
          },
          createdAt: {
            gte: startOfDay(referenceDate),
          },
        },
        select: {
          entityId: true,
          action: true,
        },
      });

      const alertedKeys = new Set(
        existingAlerts.map((alert) => `${alert.entityId}:${alert.action}`),
      );
      const documentsToAlert = actionableDocuments.filter(
        ({ document, action }) => !alertedKeys.has(`${document.id}:${action}`),
      );

      await Promise.all(
        documentsToAlert.map(({ document, action }) =>
          documentsPrisma.auditLog.create({
            data: {
              tenantId: document.tenantId,
              userId: null,
              action,
              entity: DOCUMENT_ENTITY,
              entityId: document.id,
              changes: toAuditChanges(document, referenceDate),
              ipAddress: null,
              userAgent: DOCUMENT_ALERT_SCHEDULER_USER_AGENT,
            },
          }),
        ),
      );

      if (documentsToAlert.length > 0) {
        logger.info('Alertas de documentos gerados.', {
          alertsCreated: documentsToAlert.length,
        });
      }

      return documentsToAlert.length;
    } finally {
      this.running = false;
    }
  }

  private async runSafely(referenceDate: Date = new Date()): Promise<void> {
    try {
      await this.run(referenceDate);
    } catch (error) {
      logger.error('Falha ao executar scheduler de documentos.', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const documentAlertScheduler = new DocumentAlertScheduler();
