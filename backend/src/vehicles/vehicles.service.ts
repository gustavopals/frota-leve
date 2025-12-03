import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { UpdateOdometerDto } from './dto/update-odometer.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, createVehicleDto: CreateVehicleDto) {
    const { currentKm, ...data } = createVehicleDto as any;
    
    return this.prisma.vehicle.create({
      data: {
        ...data,
        // Mapear currentKm para currentOdometer se fornecido
        currentOdometer: currentKm ?? data.currentOdometer ?? 0,
        tenantId,
      },
    });
  }

  async findAll(tenantId: string, query?: { status?: string; search?: string }) {
    const where: Prisma.VehicleWhereInput = { tenantId };

    if (query?.status) {
      where.status = query.status as any;
    }

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { plate: { contains: query.search, mode: 'insensitive' } },
        { brand: { contains: query.search, mode: 'insensitive' } },
        { model: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, tenantId },
      include: {
        maintenances: {
          take: 5,
          orderBy: { date: 'desc' },
        },
        fuelLogs: {
          take: 5,
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!vehicle) {
      throw new NotFoundException(`Veículo com ID ${id} não encontrado`);
    }

    return vehicle;
  }

  async update(tenantId: string, id: string, updateVehicleDto: UpdateVehicleDto) {
    // Verifica se o veículo existe e pertence ao tenant
    await this.findOne(tenantId, id);

    const { currentKm, ...data } = updateVehicleDto as any;

    return this.prisma.vehicle.update({
      where: { id },
      data: {
        ...data,
        // Mapear currentKm para currentOdometer se fornecido
        ...(currentKm !== undefined && { currentOdometer: currentKm }),
      },
    });
  }

  async updateOdometer(tenantId: string, id: string, updateOdometerDto: UpdateOdometerDto) {
    // Verifica se o veículo existe e pertence ao tenant
    const vehicle = await this.findOne(tenantId, id);

    // Validar que o novo odômetro não é menor que o atual
    if (updateOdometerDto.currentOdometer < Number(vehicle.currentOdometer)) {
      throw new Error('O novo valor do odômetro não pode ser menor que o atual');
    }

    return this.prisma.vehicle.update({
      where: { id },
      data: {
        currentOdometer: updateOdometerDto.currentOdometer,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    // Verifica se o veículo existe e pertence ao tenant
    await this.findOne(tenantId, id);

    return this.prisma.vehicle.delete({
      where: { id },
    });
  }

  async getStats(tenantId: string) {
    const total = await this.prisma.vehicle.count({ where: { tenantId } });
    
    const byStatus = await this.prisma.vehicle.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: true,
    });

    return {
      total,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {}),
    };
  }
}
