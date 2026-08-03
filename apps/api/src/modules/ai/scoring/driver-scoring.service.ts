import { MaintenanceType, type Prisma } from '@frota-leve/database';
import {
  computeDriverScore,
  scoringService as aiScoringService,
  shouldGenerateRecommendation,
  type DriverScoreMetrics,
} from '@frota-leve/ai';
import { prisma } from '../../../config/database';
import { logger } from '../../../config/logger';

/** Janela avaliada pelo score (TASK 3.7.2). */
export const SCORING_WINDOW_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Checklists esperados por veículo conduzido no período — base da aderência. */
const EXPECTED_CHECKLISTS_PER_VEHICLE = 12;

export interface DriverScoringResult {
  driverId: string;
  score: number;
  recommended: boolean;
}

function windowStart(reference: Date): Date {
  return new Date(reference.getTime() - SCORING_WINDOW_DAYS * DAY_MS);
}

export class DriverScoringService {
  /**
   * Calcula e persiste o score de todos os motoristas ativos do tenant.
   *
   * A recomendação por IA só roda quando o score muda >= 5 pontos vs. o período
   * anterior, conforme a economia de token pedida na TASK 3.7.3.
   */
  async scoreTenant(tenantId: string, referenceDate = new Date()): Promise<DriverScoringResult[]> {
    const start = windowStart(referenceDate);

    const [drivers, fleetFuel] = await Promise.all([
      prisma.driver.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true },
      }),
      prisma.fuelRecord.aggregate({
        where: { tenantId, date: { gte: start, lte: referenceDate }, kmPerLiter: { gt: 0 } },
        _avg: { kmPerLiter: true },
      }),
    ]);

    const fleetAverageKmPerLiter = fleetFuel._avg.kmPerLiter ?? null;
    const results: DriverScoringResult[] = [];

    for (const driver of drivers) {
      try {
        results.push(
          await this.scoreDriver({
            tenantId,
            driver,
            start,
            end: referenceDate,
            fleetAverageKmPerLiter,
          }),
        );
      } catch (error) {
        logger.error('Falha ao calcular score do motorista.', {
          tenantId,
          driverId: driver.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  private async scoreDriver(params: {
    tenantId: string;
    driver: { id: string; name: string };
    start: Date;
    end: Date;
    fleetAverageKmPerLiter: number | null;
  }): Promise<DriverScoringResult> {
    const { tenantId, driver, start, end } = params;
    const range = { gte: start, lte: end };

    const [driverFuel, fines, incidents, checklists, corrective, vehicles, previous] =
      await Promise.all([
        prisma.fuelRecord.aggregate({
          where: { tenantId, driverId: driver.id, date: range, kmPerLiter: { gt: 0 } },
          _avg: { kmPerLiter: true },
        }),
        prisma.fine.findMany({
          where: { tenantId, driverId: driver.id, date: range },
          select: { points: true },
        }),
        prisma.incident.count({ where: { tenantId, driverId: driver.id, date: range } }),
        // Conta a entrega do checklist, não o resultado: o enum de status é sobre
        // conformidade (COMPLIANT/NON_COMPLIANT/ATTENTION), e um checklist que
        // apontou problema também foi entregue.
        prisma.checklistExecution.count({
          where: { tenantId, driverId: driver.id, executedAt: range },
        }),
        prisma.serviceOrder.count({
          where: {
            tenantId,
            driverId: driver.id,
            type: MaintenanceType.CORRECTIVE,
            endDate: range,
          },
        }),
        prisma.fuelRecord.findMany({
          where: { tenantId, driverId: driver.id, date: range },
          select: { vehicleId: true },
          distinct: ['vehicleId'],
        }),
        prisma.driverScore.findFirst({
          where: { tenantId, driverId: driver.id },
          orderBy: { periodStart: 'desc' },
          select: { score: true },
        }),
      ]);

    const vehiclesDriven = vehicles.length;

    const metrics: DriverScoreMetrics = {
      kmPerLiter: driverFuel._avg.kmPerLiter ?? null,
      fleetAverageKmPerLiter: params.fleetAverageKmPerLiter,
      finesCount: fines.length,
      finePoints: fines.reduce((total, fine) => total + fine.points, 0),
      incidentsCount: incidents,
      checklistsCompleted: checklists,
      checklistsExpected: vehiclesDriven * EXPECTED_CHECKLISTS_PER_VEHICLE,
      correctiveMaintenances: corrective,
      vehiclesDriven,
    };

    const result = computeDriverScore(metrics);
    const previousScore = previous?.score ?? null;
    const recommend = shouldGenerateRecommendation(result.score, previousScore);

    let recommendations = '';

    if (recommend) {
      const generated = await aiScoringService.recommend({
        tenantId,
        driverName: driver.name,
        result,
        previousScore,
      });

      // Schema inválido devolve null e nada é persistido (critério de aceite 3.7).
      recommendations = generated ? JSON.stringify(generated) : '';
    }

    await prisma.driverScore.upsert({
      where: { driverId_periodStart: { driverId: driver.id, periodStart: start } },
      create: {
        tenantId,
        driverId: driver.id,
        periodStart: start,
        periodEnd: end,
        score: result.score,
        breakdown: result.breakdown as unknown as Prisma.InputJsonValue,
        recommendations,
      },
      update: {
        periodEnd: end,
        score: result.score,
        breakdown: result.breakdown as unknown as Prisma.InputJsonValue,
        ...(recommendations ? { recommendations } : {}),
      },
    });

    // O score corrente também fica no motorista, para a listagem não precisar
    // de join com o histórico.
    await prisma.driver.update({ where: { id: driver.id }, data: { score: result.score } });

    return { driverId: driver.id, score: result.score, recommended: recommend };
  }

  /** Histórico de scores do motorista (TASK 3.7.4). */
  async getHistory(tenantId: string, driverId: string) {
    return prisma.driverScore.findMany({
      where: { tenantId, driverId },
      orderBy: { periodStart: 'desc' },
      take: 12,
    });
  }

  /** Ranking paginado do período mais recente (TASK 3.7.4). */
  async getRanking(tenantId: string, query: { page: number; limit: number }) {
    const where: Prisma.DriverWhereInput = { tenantId, isActive: true };

    const [total, data] = await Promise.all([
      prisma.driver.count({ where }),
      prisma.driver.findMany({
        where,
        orderBy: [{ score: 'desc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: { id: true, name: true, score: true, department: true },
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
}

export const driverScoringService = new DriverScoringService();
