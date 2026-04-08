import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAINTENANCE_PLAN_ENTITY = 'MaintenancePlan';
const MAINTENANCE_PLAN_OVERDUE_ACTION = 'MAINTENANCE_PLAN_OVERDUE';
const SCHEDULER_USER_AGENT = 'maintenance-plan-alert-scheduler';

type DueReason = 'date' | 'mileage';

type MaintenancePlanAlertCandidate = {
  id: string;
  tenantId: string;
  name: string;
  type: string;
  nextDueAt: Date | null;
  nextDueMileage: number | null;
  vehicle: {
    id: string;
    plate: string;
    currentMileage: number;
  };
};

type MaintenancePlanAlertPrismaClient = {
  maintenancePlan: {
    findMany(args: unknown): Promise<MaintenancePlanAlertCandidate[]>;
  };
  auditLog: {
    findMany(args: unknown): Promise<Array<{ entityId: string }>>;
    create(args: unknown): Promise<unknown>;
  };
};

const maintenancePrisma = prisma as unknown as MaintenancePlanAlertPrismaClient;

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getDueReasons(plan: MaintenancePlanAlertCandidate, referenceDate: Date): DueReason[] {
  const reasons: DueReason[] = [];

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

function toAuditChanges(
  plan: MaintenancePlanAlertCandidate,
  reasons: DueReason[],
  referenceDate: Date,
): Prisma.InputJsonValue {
  return {
    planName: plan.name,
    planType: plan.type,
    vehicleId: plan.vehicle.id,
    vehiclePlate: plan.vehicle.plate,
    currentMileage: plan.vehicle.currentMileage,
    nextDueAt: plan.nextDueAt?.toISOString() ?? null,
    nextDueMileage: plan.nextDueMileage ?? null,
    reasons,
    generatedAt: referenceDate.toISOString(),
  };
}

export class MaintenancePlanAlertScheduler {
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  start(): void {
    if (env.NODE_ENV === 'test' || this.interval) {
      return;
    }

    logger.info('Scheduler de manutenção iniciado.');
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
        'Execução do scheduler de manutenção ignorada porque outra já está em andamento.',
      );
      return 0;
    }

    this.running = true;

    try {
      const plans = await maintenancePrisma.maintenancePlan.findMany({
        where: {
          isActive: true,
          OR: [{ nextDueAt: { not: null } }, { nextDueMileage: { not: null } }],
        },
        select: {
          id: true,
          tenantId: true,
          name: true,
          type: true,
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
      });

      const overduePlans = plans
        .map((plan) => ({
          plan,
          reasons: getDueReasons(plan, referenceDate),
        }))
        .filter((entry) => entry.reasons.length > 0);

      if (overduePlans.length === 0) {
        return 0;
      }

      const existingAlerts = await maintenancePrisma.auditLog.findMany({
        where: {
          action: MAINTENANCE_PLAN_OVERDUE_ACTION,
          entity: MAINTENANCE_PLAN_ENTITY,
          entityId: {
            in: overduePlans.map(({ plan }) => plan.id),
          },
          createdAt: {
            gte: startOfDay(referenceDate),
          },
        },
        select: {
          entityId: true,
        },
      });

      const alertedPlanIds = new Set(existingAlerts.map((alert) => alert.entityId));
      const plansToAlert = overduePlans.filter(({ plan }) => !alertedPlanIds.has(plan.id));

      await Promise.all(
        plansToAlert.map(({ plan, reasons }) =>
          maintenancePrisma.auditLog.create({
            data: {
              tenantId: plan.tenantId,
              userId: null,
              action: MAINTENANCE_PLAN_OVERDUE_ACTION,
              entity: MAINTENANCE_PLAN_ENTITY,
              entityId: plan.id,
              changes: toAuditChanges(plan, reasons, referenceDate),
              ipAddress: null,
              userAgent: SCHEDULER_USER_AGENT,
            },
          }),
        ),
      );

      if (plansToAlert.length > 0) {
        logger.info('Alertas de manutenção vencida gerados.', {
          alertsCreated: plansToAlert.length,
        });
      }

      return plansToAlert.length;
    } finally {
      this.running = false;
    }
  }

  private async runSafely(referenceDate: Date = new Date()): Promise<void> {
    try {
      await this.run(referenceDate);
    } catch (error) {
      logger.error('Falha ao executar scheduler de manutenção.', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const maintenancePlanAlertScheduler = new MaintenancePlanAlertScheduler();
export { MAINTENANCE_PLAN_ENTITY, MAINTENANCE_PLAN_OVERDUE_ACTION };
