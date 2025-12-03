import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { CreateFuelLogDto } from './dto/create-fuel-log.dto';
import { UpdateFuelLogDto } from './dto/update-fuel-log.dto';

@Injectable()
export class FuelService {
  constructor(private prisma: PrismaService) {}

  async create(createFuelLogDto: CreateFuelLogDto, tenantId: string) {
    // Verificar se o veículo existe e pertence ao tenant
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: createFuelLogDto.vehicleId,
        tenantId,
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado');
    }

    // Se driverId foi fornecido, verificar se pertence ao tenant
    if (createFuelLogDto.driverId) {
      const driver = await this.prisma.user.findFirst({
        where: {
          id: createFuelLogDto.driverId,
          tenantId,
        },
      });

      if (!driver) {
        throw new NotFoundException('Motorista não encontrado');
      }
    }

    // Criar o registro de abastecimento
    const fuelLog = await this.prisma.fuelLog.create({
      data: {
        ...createFuelLogDto,
        tenantId,
        date: new Date(createFuelLogDto.date),
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
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Atualizar o odômetro do veículo se for maior que o atual
    if (createFuelLogDto.odometer > Number(vehicle.currentOdometer)) {
      await this.prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { currentOdometer: createFuelLogDto.odometer },
      });
    }

    return fuelLog;
  }

  async findAll(tenantId: string, vehicleId?: string) {
    const where: { tenantId: string; vehicleId?: string } = { tenantId };
    
    if (vehicleId) {
      where.vehicleId = vehicleId;
    }

    return this.prisma.fuelLog.findMany({
      where,
      include: {
        vehicle: {
          select: {
            id: true,
            plate: true,
            model: true,
            brand: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });
  }

  async findOne(id: string, tenantId: string) {
    const fuelLog = await this.prisma.fuelLog.findFirst({
      where: {
        id,
        tenantId,
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
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!fuelLog) {
      throw new NotFoundException('Registro de abastecimento não encontrado');
    }

    return fuelLog;
  }

  async update(id: string, updateFuelLogDto: UpdateFuelLogDto, tenantId: string) {
    const fuelLog = await this.findOne(id, tenantId);

    // Verificar veículo se foi alterado
    if (updateFuelLogDto.vehicleId && updateFuelLogDto.vehicleId !== fuelLog.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({
        where: {
          id: updateFuelLogDto.vehicleId,
          tenantId,
        },
      });

      if (!vehicle) {
        throw new NotFoundException('Veículo não encontrado');
      }
    }

    // Verificar motorista se foi alterado
    if (updateFuelLogDto.driverId && updateFuelLogDto.driverId !== fuelLog.driverId) {
      const driver = await this.prisma.user.findFirst({
        where: {
          id: updateFuelLogDto.driverId,
          tenantId,
        },
      });

      if (!driver) {
        throw new NotFoundException('Motorista não encontrado');
      }
    }

    return this.prisma.fuelLog.update({
      where: { id },
      data: {
        ...updateFuelLogDto,
        date: updateFuelLogDto.date ? new Date(updateFuelLogDto.date) : undefined,
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
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async remove(id: string, tenantId: string) {
    await this.findOne(id, tenantId);
    
    return this.prisma.fuelLog.delete({
      where: { id },
    });
  }

  async getAnalytics(vehicleId: string, tenantId: string) {
    // Verificar se o veículo existe e pertence ao tenant
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        tenantId,
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado');
    }

    // Buscar todos os abastecimentos do veículo ordenados por data
    const fuelLogs = await this.prisma.fuelLog.findMany({
      where: {
        vehicleId,
        tenantId,
      },
      orderBy: {
        date: 'asc',
      },
    });

    if (fuelLogs.length < 2) {
      return {
        vehicleId,
        totalRefuels: fuelLogs.length,
        totalLiters: fuelLogs.reduce((sum, log) => sum + Number(log.liters), 0),
        totalSpent: fuelLogs.reduce((sum, log) => sum + Number(log.totalValue), 0),
        averageConsumption: null,
        averagePricePerLiter: null,
      };
    }

    // Calcular consumo médio (km/l)
    let totalDistance = 0;
    let totalLiters = 0;
    let totalSpent = 0;

    for (let i = 1; i < fuelLogs.length; i++) {
      const distance = Number(fuelLogs[i].odometer) - Number(fuelLogs[i - 1].odometer);
      const liters = Number(fuelLogs[i].liters);
      
      if (distance > 0 && liters > 0) {
        totalDistance += distance;
        totalLiters += liters;
      }
      
      totalSpent += Number(fuelLogs[i].totalValue);
    }

    totalSpent += Number(fuelLogs[0].totalValue);
    const totalRefuelLiters = fuelLogs.reduce((sum, log) => sum + Number(log.liters), 0);

    return {
      vehicleId,
      totalRefuels: fuelLogs.length,
      totalLiters: totalRefuelLiters,
      totalSpent,
      averageConsumption: totalDistance > 0 ? totalDistance / totalLiters : null,
      averagePricePerLiter: totalRefuelLiters > 0 ? totalSpent / totalRefuelLiters : null,
      totalDistance,
    };
  }

  async getStats(tenantId: string) {
    const fuelLogs = await this.prisma.fuelLog.findMany({
      where: { tenantId },
    });

    const totalLiters = fuelLogs.reduce((sum, log) => sum + Number(log.liters), 0);
    const totalSpent = fuelLogs.reduce((sum, log) => sum + Number(log.totalValue), 0);

    return {
      totalRefuels: fuelLogs.length,
      totalLiters,
      totalSpent,
      averagePricePerLiter: totalLiters > 0 ? totalSpent / totalLiters : 0,
    };
  }
}
