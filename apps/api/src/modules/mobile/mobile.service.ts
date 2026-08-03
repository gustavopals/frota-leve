import { ResponsibilityTermStatus, ServiceOrderStatus } from '@frota-leve/database';
import type { Prisma } from '@frota-leve/database';
import { prisma } from '../../config/database';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors';
import { ChecklistsService } from '../checklists/checklists.service';
import { FuelRecordsService } from '../fuel-records/fuel-records.service';
import { IncidentsService } from '../incidents/incidents.service';
import type { MobileActorContext } from './mobile.types';
import type {
  MobileChecklistExecutionInput,
  MobileFuelRecordInput,
  MobileProblemInput,
  SignResponsibilityTermInput,
} from './mobile.validators';

const TERM_VERSION = '2026.1';

const checklistsService = new ChecklistsService();
const fuelRecordsService = new FuelRecordsService();
const incidentsService = new IncidentsService();

function termContent(driverName: string, plate: string, vehicleName: string): string {
  return [
    `Eu, ${driverName}, declaro que recebi o veículo ${vehicleName}, placa ${plate}, em condições de uso.`,
    'Comprometo-me a realizar o checklist antes da operação, comunicar imediatamente avarias e ocorrências, respeitar as normas de trânsito e utilizar o veículo somente para atividades autorizadas.',
    'Reconheço que a assinatura digital, acompanhada de data, localização e identificação da minha conta, representa minha concordância com este termo de responsabilidade.',
  ].join('\n\n');
}

function normalizePhotos(value: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export class MobileService {
  async getContext(context: MobileActorContext) {
    const driver = await this.driverForUser(context);
    const vehicle = await prisma.vehicle.findFirst({
      where: { tenantId: context.tenantId, currentDriverId: context.userId },
    });

    const [user, tenant, unreadNotifications, totalDrivers, betterDrivers, latestScore] =
      await Promise.all([
        prisma.user.findFirst({
          where: { id: context.userId, tenantId: context.tenantId },
          select: {
            id: true,
            tenantId: true,
            name: true,
            email: true,
            role: true,
            avatarUrl: true,
          },
        }),
        prisma.tenant.findUnique({
          where: { id: context.tenantId },
          select: { id: true, name: true, plan: true, status: true },
        }),
        prisma.notification.count({
          where: { tenantId: context.tenantId, userId: context.userId, isRead: false },
        }),
        prisma.driver.count({ where: { tenantId: context.tenantId, isActive: true } }),
        prisma.driver.count({
          where: {
            tenantId: context.tenantId,
            isActive: true,
            score: { gt: driver.score ?? 0 },
          },
        }),
        prisma.driverScore.findFirst({
          where: { tenantId: context.tenantId, driverId: driver.id },
          orderBy: { periodStart: 'desc' },
        }),
      ]);

    if (!user || !tenant) throw new NotFoundError('Conta do motorista não encontrada');

    const [maintenance, serviceOrders, responsibilityTerm, recentFines, recentChecklists] = vehicle
      ? await Promise.all([
          prisma.maintenancePlan.findMany({
            where: { tenantId: context.tenantId, vehicleId: vehicle.id, isActive: true },
            orderBy: [{ nextDueAt: 'asc' }, { nextDueMileage: 'asc' }],
            take: 5,
            select: {
              id: true,
              name: true,
              nextDueAt: true,
              nextDueMileage: true,
            },
          }),
          prisma.serviceOrder.findMany({
            where: {
              tenantId: context.tenantId,
              vehicleId: vehicle.id,
              status: { notIn: [ServiceOrderStatus.COMPLETED, ServiceOrderStatus.CANCELLED] },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              description: true,
              status: true,
              startDate: true,
              workshop: true,
            },
          }),
          this.ensureResponsibilityTerm(context, driver.id, driver.name, vehicle),
          prisma.fine.count({
            where: {
              tenantId: context.tenantId,
              driverId: driver.id,
              date: { gte: new Date(Date.now() - 90 * 86_400_000) },
            },
          }),
          prisma.checklistExecution.findMany({
            where: {
              tenantId: context.tenantId,
              driverId: driver.id,
              executedAt: { gte: new Date(Date.now() - 30 * 86_400_000) },
            },
            select: { status: true },
          }),
        ])
      : [[], [], null, 0, []];

    const rank = totalDrivers > 0 ? betterDrivers + 1 : null;
    const topTwenty = rank != null && rank <= Math.max(1, Math.ceil(totalDrivers * 0.2));
    const checklistInDay =
      recentChecklists.length > 0 && recentChecklists.every((item) => item.status === 'COMPLIANT');

    return {
      user,
      tenant,
      driver: {
        id: driver.id,
        name: driver.name,
        email: driver.email,
        phone: driver.phone,
        department: driver.department,
        photoUrl: driver.photoUrl,
        cnhCategory: driver.cnhCategory,
        cnhExpiration: driver.cnhExpiration,
        score: driver.score ?? 0,
      },
      vehicle: vehicle
        ? {
            id: vehicle.id,
            plate: vehicle.plate,
            brand: vehicle.brand,
            model: vehicle.model,
            year: vehicle.year,
            category: vehicle.category,
            fuelType: vehicle.fuelType,
            status: vehicle.status,
            currentMileage: vehicle.currentMileage,
            averageConsumption: vehicle.averageConsumption,
            photos: normalizePhotos(vehicle.photos),
          }
        : null,
      maintenance: maintenance.map((item) => ({
        id: item.id,
        description: item.name,
        nextDueAt: item.nextDueAt,
        nextDueMileage: item.nextDueMileage,
        status: this.maintenanceStatus(
          item.nextDueAt,
          item.nextDueMileage,
          vehicle?.currentMileage,
        ),
      })),
      serviceOrders,
      score: {
        score: Math.round(driver.score ?? 0),
        rank,
        totalDrivers,
        breakdown:
          latestScore?.breakdown && typeof latestScore.breakdown === 'object'
            ? (latestScore.breakdown as Record<string, number>)
            : null,
        badges: [
          {
            code: 'ECONOMIC_DRIVER',
            label: 'Direção econômica',
            description: 'Entre os 20% melhores scores da frota.',
            earned: topTwenty,
          },
          {
            code: 'ZERO_FINES_90D',
            label: 'Zero multas · 90 dias',
            description: 'Nenhuma multa atribuída nos últimos 90 dias.',
            earned: recentFines === 0,
          },
          {
            code: 'CHECKLIST_30D',
            label: 'Checklist em dia',
            description: 'Checklists conformes nos últimos 30 dias.',
            earned: checklistInDay,
          },
        ],
      },
      unreadNotifications,
      responsibilityTerm,
      refreshedAt: new Date().toISOString(),
    };
  }

  async listChecklistTemplates(context: MobileActorContext) {
    const { vehicle } = await this.assignmentForUser(context);
    return prisma.checklistTemplate.findMany({
      where: {
        tenantId: context.tenantId,
        OR: [{ vehicleCategory: null }, { vehicleCategory: vehicle.category }],
      },
      include: { items: { orderBy: { displayOrder: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async executeChecklist(context: MobileActorContext, input: MobileChecklistExecutionInput) {
    const { driver, vehicle } = await this.assignmentForUser(context);
    return checklistsService.executeChecklist(context, {
      ...input,
      driverId: driver.id,
      vehicleId: vehicle.id,
    });
  }

  async createFuelRecord(context: MobileActorContext, input: MobileFuelRecordInput) {
    const { driver, vehicle } = await this.assignmentForUser(context);
    if (input.mileage < vehicle.currentMileage) {
      throw new ValidationError('A quilometragem não pode ser menor que a atual do veículo');
    }
    return fuelRecordsService.createFuelRecord(context, {
      ...input,
      driverId: driver.id,
      vehicleId: vehicle.id,
    });
  }

  async reportProblem(context: MobileActorContext, input: MobileProblemInput) {
    const { driver, vehicle } = await this.assignmentForUser(context);
    return incidentsService.createIncident(context, {
      ...input,
      driverId: driver.id,
      vehicleId: vehicle.id,
      insurerNotified: false,
      insuranceClaimNumber: null,
      estimatedCost: null,
      actualCost: null,
      documents: [],
      downtime: null,
      notes: 'Ocorrência registrada pelo aplicativo do motorista.',
    });
  }

  async signResponsibilityTerm(
    context: MobileActorContext,
    termId: string,
    input: SignResponsibilityTermInput,
  ) {
    const { driver, vehicle } = await this.assignmentForUser(context);
    const term = await prisma.responsibilityTerm.findFirst({
      where: {
        id: termId,
        tenantId: context.tenantId,
        userId: context.userId,
        driverId: driver.id,
        vehicleId: vehicle.id,
      },
    });

    if (!term) throw new NotFoundError('Termo de responsabilidade não encontrado');
    if (term.status === ResponsibilityTermStatus.SIGNED) return term;

    return prisma.$transaction(async (tx) => {
      const signed = await tx.responsibilityTerm.update({
        where: { id: term.id },
        data: {
          status: ResponsibilityTermStatus.SIGNED,
          signatureUrl: input.signatureUrl,
          signedAt: new Date(),
          signedLocation: input.location ?? null,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'RESPONSIBILITY_TERM_SIGNED',
          entity: 'ResponsibilityTerm',
          entityId: signed.id,
          changes: { vehicleId: vehicle.id, driverId: driver.id, version: TERM_VERSION },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
      return signed;
    });
  }

  private async driverForUser(context: MobileActorContext) {
    const driver = await prisma.driver.findFirst({
      where: { tenantId: context.tenantId, userId: context.userId, isActive: true },
    });
    if (!driver) {
      throw new ForbiddenError('Seu usuário ainda não está vinculado a um cadastro de motorista');
    }
    return driver;
  }

  private async assignmentForUser(context: MobileActorContext) {
    const driver = await this.driverForUser(context);
    const vehicle = await prisma.vehicle.findFirst({
      where: { tenantId: context.tenantId, currentDriverId: context.userId },
    });
    if (!vehicle) throw new ForbiddenError('Nenhum veículo está vinculado ao seu usuário');
    return { driver, vehicle };
  }

  private async ensureResponsibilityTerm(
    context: MobileActorContext,
    driverId: string,
    driverName: string,
    vehicle: { id: string; plate: string; brand: string; model: string },
  ) {
    return prisma.responsibilityTerm.upsert({
      where: {
        vehicleId_driverId_contentVersion: {
          vehicleId: vehicle.id,
          driverId,
          contentVersion: TERM_VERSION,
        },
      },
      create: {
        tenantId: context.tenantId,
        userId: context.userId,
        vehicleId: vehicle.id,
        driverId,
        contentVersion: TERM_VERSION,
        content: termContent(driverName, vehicle.plate, `${vehicle.brand} ${vehicle.model}`),
      },
      // Mantém o termo acessível quando o mesmo cadastro de motorista é
      // religado a outra conta de usuário, sem alterar a assinatura existente.
      update: { userId: context.userId },
    });
  }

  private maintenanceStatus(
    nextDueAt: Date | null,
    nextDueMileage: number | null,
    currentMileage?: number,
  ): 'OVERDUE' | 'UPCOMING' | 'OK' {
    const now = Date.now();
    const hasMileageReference = nextDueMileage != null && currentMileage != null;
    if (
      (nextDueAt != null && nextDueAt.getTime() < now) ||
      (hasMileageReference && nextDueMileage <= currentMileage)
    ) {
      return 'OVERDUE';
    }
    if (
      (nextDueAt != null && nextDueAt.getTime() <= now + 30 * 86_400_000) ||
      (hasMileageReference && nextDueMileage <= currentMileage + 1_000)
    ) {
      return 'UPCOMING';
    }
    return 'OK';
  }
}

export const mobileService = new MobileService();
