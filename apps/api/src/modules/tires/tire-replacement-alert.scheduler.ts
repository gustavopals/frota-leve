import { type Prisma } from '@frota-leve/database';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import {
  buildTireReplacementAlertWhere,
  calculateMmBelowThreshold,
  calculateRemainingUsefulLifePercentage,
  DEFAULT_TIRE_REPLACEMENT_THRESHOLD,
  startOfDay,
  TIRE_ENTITY,
  TIRE_REPLACEMENT_ALERT_ACTION,
  TIRE_REPLACEMENT_ALERT_SCHEDULER_USER_AGENT,
} from './tires.alerts';

const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;

type TireAlertCandidate = {
  id: string;
  tenantId: string;
  serialNumber: string;
  brand: string;
  model: string;
  size: string;
  currentVehicleId: string | null;
  position: string | null;
  currentGrooveDepth: number;
  originalGrooveDepth: number;
  totalKm: number;
  currentVehicle: {
    id: string;
    plate: string;
    brand: string;
    model: string;
    year: number;
  } | null;
};

type TireReplacementAlertPrismaClient = {
  tire: {
    findMany(args: unknown): Promise<TireAlertCandidate[]>;
  };
  auditLog: {
    findMany(args: unknown): Promise<Array<{ entityId: string }>>;
    create(args: unknown): Promise<unknown>;
  };
};

const tireAlertsPrisma = prisma as unknown as TireReplacementAlertPrismaClient;

function toAuditChanges(
  tire: TireAlertCandidate,
  threshold: number,
  referenceDate: Date,
): Prisma.InputJsonValue {
  return {
    serialNumber: tire.serialNumber,
    brand: tire.brand,
    model: tire.model,
    size: tire.size,
    vehicleId: tire.currentVehicleId,
    vehiclePlate: tire.currentVehicle?.plate ?? null,
    position: tire.position,
    currentGrooveDepth: tire.currentGrooveDepth,
    originalGrooveDepth: tire.originalGrooveDepth,
    threshold,
    mmBelowThreshold: calculateMmBelowThreshold(tire.currentGrooveDepth, threshold),
    remainingUsefulLifePercentage: calculateRemainingUsefulLifePercentage(
      tire.currentGrooveDepth,
      tire.originalGrooveDepth,
    ),
    totalKm: tire.totalKm,
    generatedAt: referenceDate.toISOString(),
  };
}

export class TireReplacementAlertScheduler {
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  start(): void {
    if (env.NODE_ENV === 'test' || this.interval) {
      return;
    }

    logger.info('Scheduler de alertas de pneus iniciado.');
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

  async run(
    referenceDate: Date = new Date(),
    threshold: number = DEFAULT_TIRE_REPLACEMENT_THRESHOLD,
  ): Promise<number> {
    if (this.running) {
      logger.warn(
        'Execução do scheduler de alertas de pneus ignorada porque outra já está em andamento.',
      );
      return 0;
    }

    this.running = true;

    try {
      const tires = await tireAlertsPrisma.tire.findMany({
        where: buildTireReplacementAlertWhere(undefined, threshold),
        select: {
          id: true,
          tenantId: true,
          serialNumber: true,
          brand: true,
          model: true,
          size: true,
          currentVehicleId: true,
          position: true,
          currentGrooveDepth: true,
          originalGrooveDepth: true,
          totalKm: true,
          currentVehicle: {
            select: {
              id: true,
              plate: true,
              brand: true,
              model: true,
              year: true,
            },
          },
        },
      });

      if (tires.length === 0) {
        return 0;
      }

      const existingAlerts = await tireAlertsPrisma.auditLog.findMany({
        where: {
          action: TIRE_REPLACEMENT_ALERT_ACTION,
          entity: TIRE_ENTITY,
          entityId: {
            in: tires.map((tire) => tire.id),
          },
          createdAt: {
            gte: startOfDay(referenceDate),
          },
        },
        select: {
          entityId: true,
        },
      });

      const alertedTireIds = new Set(existingAlerts.map((alert) => alert.entityId));
      const tiresToAlert = tires.filter((tire) => !alertedTireIds.has(tire.id));

      await Promise.all(
        tiresToAlert.map((tire) =>
          tireAlertsPrisma.auditLog.create({
            data: {
              tenantId: tire.tenantId,
              userId: null,
              action: TIRE_REPLACEMENT_ALERT_ACTION,
              entity: TIRE_ENTITY,
              entityId: tire.id,
              changes: toAuditChanges(tire, threshold, referenceDate),
              ipAddress: null,
              userAgent: TIRE_REPLACEMENT_ALERT_SCHEDULER_USER_AGENT,
            },
          }),
        ),
      );

      if (tiresToAlert.length > 0) {
        logger.info('Alertas de troca de pneus gerados.', {
          alertsCreated: tiresToAlert.length,
          threshold,
        });
      }

      return tiresToAlert.length;
    } finally {
      this.running = false;
    }
  }

  private async runSafely(referenceDate: Date = new Date()): Promise<void> {
    try {
      await this.run(referenceDate);
    } catch (error) {
      logger.error('Falha ao executar scheduler de alertas de pneus.', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const tireReplacementAlertScheduler = new TireReplacementAlertScheduler();
