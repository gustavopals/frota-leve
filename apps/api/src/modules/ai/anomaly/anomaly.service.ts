import { AIAnomalySeverity, AIAnomalyStatus, type Prisma } from '@frota-leve/database';
import { prisma } from '../../../config/database';
import { NotFoundError } from '../../../shared/errors';
import type { ListAnomaliesQueryInput } from './anomaly.validators';

/** Peso de cada severidade no health score do veículo (TASK 3.4.6). */
const HEALTH_PENALTY: Record<AIAnomalySeverity, number> = {
  [AIAnomalySeverity.HIGH]: 25,
  [AIAnomalySeverity.MED]: 10,
  [AIAnomalySeverity.LOW]: 4,
};

const DASHBOARD_INSIGHT_LIMIT = 5;

export interface AnomalyActorContext {
  tenantId: string;
  userId: string;
}

export class AnomalyService {
  async list(ctx: AnomalyActorContext, query: ListAnomaliesQueryInput) {
    const where: Prisma.AIAnomalyWhereInput = {
      tenantId: ctx.tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
    };

    const [total, data] = await Promise.all([
      prisma.aIAnomaly.count({ where }),
      prisma.aIAnomaly.findMany({
        where,
        orderBy: [{ detectedAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);

    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(Math.ceil(total / query.limit), 1),
      },
    };
  }

  /** Top anomalias abertas HIGH+MED — alimenta o widget "Insights IA". */
  async listDashboardInsights(ctx: AnomalyActorContext) {
    return prisma.aIAnomaly.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: AIAnomalyStatus.OPEN,
        severity: { in: [AIAnomalySeverity.HIGH, AIAnomalySeverity.MED] },
      },
      orderBy: [{ severity: 'asc' }, { detectedAt: 'desc' }],
      take: DASHBOARD_INSIGHT_LIMIT,
    });
  }

  /**
   * Anomalias abertas de um veículo + health score.
   *
   * Score = 100 − penalidades por severidade, com piso em zero.
   */
  async getVehicleAnalysis(ctx: AnomalyActorContext, vehicleId: string) {
    const anomalies = await prisma.aIAnomaly.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: AIAnomalyStatus.OPEN,
        entityType: 'vehicle',
        entityId: vehicleId,
      },
      orderBy: [{ detectedAt: 'desc' }],
    });

    const penalty = anomalies.reduce(
      (total, anomaly) => total + (HEALTH_PENALTY[anomaly.severity] ?? 0),
      0,
    );

    return {
      vehicleId,
      healthScore: Math.max(0, 100 - penalty),
      openAnomalies: anomalies,
    };
  }

  async acknowledge(ctx: AnomalyActorContext, anomalyId: string) {
    return this.transition(ctx, anomalyId, AIAnomalyStatus.ACK);
  }

  async dismiss(ctx: AnomalyActorContext, anomalyId: string) {
    return this.transition(ctx, anomalyId, AIAnomalyStatus.DISMISSED);
  }

  /**
   * Muda o status de uma anomalia. O `updateMany` com `tenantId` no filtro evita
   * que um tenant consiga alterar a anomalia de outro mesmo conhecendo o id.
   */
  private async transition(ctx: AnomalyActorContext, anomalyId: string, status: AIAnomalyStatus) {
    const result = await prisma.aIAnomaly.updateMany({
      where: { id: anomalyId, tenantId: ctx.tenantId },
      data: {
        status,
        acknowledgedAt: new Date(),
        acknowledgedById: ctx.userId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundError('Anomalia não encontrada');
    }

    return prisma.aIAnomaly.findFirst({ where: { id: anomalyId, tenantId: ctx.tenantId } });
  }
}

export const anomalyService = new AnomalyService();
