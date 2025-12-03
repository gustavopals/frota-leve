import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { CreateMaintenancePlanDto } from './dto/create-maintenance-plan.dto';
import { UpdateMaintenancePlanDto } from './dto/update-maintenance-plan.dto';

@Injectable()
export class MaintenanceService {
  constructor(private prisma: PrismaService) {}

  // ==================== MAINTENANCE PLANS ====================

  async createPlan(tenantId: string, dto: CreateMaintenancePlanDto) {
    return this.prisma.maintenancePlan.create({
      data: {
        ...dto,
        tenantId,
      },
    });
  }

  async findAllPlans(tenantId: string) {
    return this.prisma.maintenancePlan.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOnePlan(tenantId: string, id: string) {
    const plan = await this.prisma.maintenancePlan.findFirst({
      where: { id, tenantId },
    });

    if (!plan) {
      throw new NotFoundException('Plano de manutenção não encontrado');
    }

    return plan;
  }

  async updatePlan(tenantId: string, id: string, dto: UpdateMaintenancePlanDto) {
    await this.findOnePlan(tenantId, id);

    return this.prisma.maintenancePlan.update({
      where: { id },
      data: dto,
    });
  }

  async removePlan(tenantId: string, id: string) {
    await this.findOnePlan(tenantId, id);

    return this.prisma.maintenancePlan.delete({
      where: { id },
    });
  }

  // ==================== MAINTENANCES ====================

  async create(tenantId: string, dto: CreateMaintenanceDto) {
    // Verificar se o veículo pertence ao tenant
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, tenantId },
    });

    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado');
    }

    // Se maintenancePlanId foi fornecido, verificar se pertence ao tenant
    if (dto.maintenancePlanId) {
      const plan = await this.prisma.maintenancePlan.findFirst({
        where: { id: dto.maintenancePlanId, tenantId },
      });

      if (!plan) {
        throw new NotFoundException('Plano de manutenção não encontrado');
      }
    }

    return this.prisma.maintenance.create({
      data: {
        ...dto,
        tenantId,
        date: new Date(dto.date),
      },
      include: {
        vehicle: {
          select: {
            id: true,
            plate: true,
            model: true,
            brand: true,
          },
        },
        maintenancePlan: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async findAll(tenantId: string, vehicleId?: string) {
    return this.prisma.maintenance.findMany({
      where: {
        tenantId,
        ...(vehicleId && { vehicleId }),
      },
      include: {
        vehicle: {
          select: {
            id: true,
            plate: true,
            model: true,
            brand: true,
          },
        },
        maintenancePlan: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const maintenance = await this.prisma.maintenance.findFirst({
      where: { id, tenantId },
      include: {
        vehicle: {
          select: {
            id: true,
            plate: true,
            model: true,
            brand: true,
            year: true,
            currentOdometer: true,
          },
        },
        maintenancePlan: true,
      },
    });

    if (!maintenance) {
      throw new NotFoundException('Manutenção não encontrada');
    }

    return maintenance;
  }

  async update(tenantId: string, id: string, dto: UpdateMaintenanceDto) {
    await this.findOne(tenantId, id);

    const updateData = { ...dto, date: undefined };
    if (dto.date) {
      updateData.date = new Date(dto.date) as unknown as string;
    }

    return this.prisma.maintenance.update({
      where: { id },
      data: updateData,
      include: {
        vehicle: {
          select: {
            id: true,
            plate: true,
            model: true,
            brand: true,
          },
        },
        maintenancePlan: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    return this.prisma.maintenance.delete({
      where: { id },
    });
  }

  // ==================== UPCOMING MAINTENANCES ====================

  async getUpcoming(tenantId: string) {
    // Buscar todos os planos e veículos ativos do tenant
    const plans = await this.prisma.maintenancePlan.findMany({
      where: { tenantId },
    });

    const vehicles = await this.prisma.vehicle.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: {
        maintenances: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    const upcoming = [];

    for (const vehicle of vehicles) {
      for (const plan of plans) {
        const lastMaintenance = vehicle.maintenances.find((m) => m.maintenancePlanId === plan.id);

        let nextDueDate: Date | null = null;
        let nextDueKm: number | null = null;
        let status: 'OK' | 'WARNING' | 'OVERDUE' = 'OK';

        // Calcular próxima data
        if (plan.intervalDays) {
          if (lastMaintenance) {
            nextDueDate = new Date(lastMaintenance.date);
            nextDueDate.setDate(nextDueDate.getDate() + plan.intervalDays);
          } else {
            nextDueDate = new Date();
            nextDueDate.setDate(nextDueDate.getDate() + plan.intervalDays);
          }

          const today = new Date();
          const daysUntilDue = Math.floor(
            (nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
          );

          if (daysUntilDue < 0) status = 'OVERDUE';
          else if (daysUntilDue <= 30) status = 'WARNING';
        }

        // Calcular próxima quilometragem
        if (plan.intervalKm) {
          const intervalKmNum = Number(plan.intervalKm);
          if (lastMaintenance?.odometer) {
            nextDueKm = Number(lastMaintenance.odometer) + intervalKmNum;
          } else {
            nextDueKm = Number(vehicle.currentOdometer) + intervalKmNum;
          }

          const kmUntilDue = nextDueKm - Number(vehicle.currentOdometer);

          if (kmUntilDue < 0) status = 'OVERDUE';
          else if (kmUntilDue <= 1000) status = 'WARNING';
        }

        upcoming.push({
          vehicleId: vehicle.id,
          vehiclePlate: vehicle.plate,
          vehicleModel: vehicle.model,
          planId: plan.id,
          planName: plan.name,
          nextDueDate,
          nextDueKm,
          currentKm: vehicle.currentOdometer,
          status,
          lastMaintenanceDate: lastMaintenance?.date || null,
        });
      }
    }

    // Ordenar por status (OVERDUE primeiro)
    return upcoming.sort((a, b) => {
      const statusOrder = { OVERDUE: 0, WARNING: 1, OK: 2 };
      return statusOrder[a.status] - statusOrder[b.status];
    });
  }

  // ==================== STATS ====================

  async getStats(tenantId: string) {
    const totalMaintenances = await this.prisma.maintenance.count({
      where: { tenantId },
    });

    const totalCost = await this.prisma.maintenance.aggregate({
      where: { tenantId },
      _sum: { cost: true },
    });

    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const monthlyMaintenances = await this.prisma.maintenance.count({
      where: {
        tenantId,
        date: { gte: currentMonth },
      },
    });

    const monthlyCost = await this.prisma.maintenance.aggregate({
      where: {
        tenantId,
        date: { gte: currentMonth },
      },
      _sum: { cost: true },
    });

    const upcoming = await this.getUpcoming(tenantId);
    const overdueCount = upcoming.filter((m) => m.status === 'OVERDUE').length;

    return {
      totalMaintenances,
      totalCost: totalCost._sum.cost || 0,
      monthlyMaintenances,
      monthlyCost: monthlyCost._sum.cost || 0,
      overdueCount,
    };
  }
}
