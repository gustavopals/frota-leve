import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { CreateChecklistTemplateDto } from './dto/create-template.dto';
import { UpdateChecklistTemplateDto } from './dto/update-template.dto';
import { CreateChecklistSubmissionDto } from './dto/create-submission.dto';
import { ChecklistItemType, ChecklistStatus } from '@prisma/client';

@Injectable()
export class ChecklistService {
  constructor(private prisma: PrismaService) {}

  // ===== TEMPLATES =====

  async createTemplate(dto: CreateChecklistTemplateDto, tenantId: string) {
    const { items, ...templateData } = dto;

    const template = await this.prisma.checklistTemplate.create({
      data: {
        ...templateData,
        tenantId,
        items: {
          create: items.map((item, index) => ({
            label: item.label,
            type: item.type as ChecklistItemType,
            config: item.config || {},
            sortOrder: item.sortOrder ?? index,
          })),
        },
      },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return template;
  }

  async findAllTemplates(tenantId: string) {
    return this.prisma.checklistTemplate.findMany({
      where: { tenantId },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { checklistSubmissions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneTemplate(id: string, tenantId: string) {
    const template = await this.prisma.checklistTemplate.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Template não encontrado');
    }

    return template;
  }

  async updateTemplate(id: string, dto: UpdateChecklistTemplateDto, tenantId: string) {
    await this.findOneTemplate(id, tenantId);

    const { items, ...templateData } = dto;

    // Se items foi fornecido, atualiza todos os itens
    if (items) {
      // Remove itens antigos
      await this.prisma.checklistTemplateItem.deleteMany({
        where: { templateId: id },
      });

      // Cria novos itens
      return this.prisma.checklistTemplate.update({
        where: { id },
        data: {
          ...templateData,
          items: {
            create: items.map((item, index) => ({
              label: item.label,
              type: item.type as ChecklistItemType,
              config: item.config || {},
              sortOrder: item.sortOrder ?? index,
            })),
          },
        },
        include: {
          items: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      });
    }

    return this.prisma.checklistTemplate.update({
      where: { id },
      data: templateData,
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async removeTemplate(id: string, tenantId: string) {
    await this.findOneTemplate(id, tenantId);

    return this.prisma.checklistTemplate.delete({
      where: { id },
    });
  }

  // ===== SUBMISSIONS =====

  async createSubmission(dto: CreateChecklistSubmissionDto, driverId: string, tenantId: string) {
    // Verificar template
    await this.findOneTemplate(dto.templateId, tenantId);

    // Verificar veículo
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: dto.vehicleId, tenantId },
    });

    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado');
    }

    // Verificar motorista
    const driver = await this.prisma.user.findFirst({
      where: { id: driverId, tenantId },
    });

    if (!driver) {
      throw new NotFoundException('Motorista não encontrado');
    }

    // Criar submission
    const submission = await this.prisma.checklistSubmission.create({
      data: {
        templateId: dto.templateId,
        vehicleId: dto.vehicleId,
        driverId,
        tenantId,
        overallStatus: (dto.overallStatus || 'OK') as ChecklistStatus,
        answers: {
          create: dto.answers.map((answer) => ({
            templateItemId: answer.templateItemId,
            value: answer.value,
          })),
        },
      },
      include: {
        template: true,
        vehicle: {
          select: {
            id: true,
            name: true,
            plate: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        answers: {
          include: {
            templateItem: true,
          },
        },
      },
    });

    return submission;
  }

  async findAllSubmissions(tenantId: string, vehicleId?: string, driverId?: string) {
    const where: { tenantId: string; vehicleId?: string; driverId?: string } = { tenantId };

    if (vehicleId) {
      where.vehicleId = vehicleId;
    }

    if (driverId) {
      where.driverId = driverId;
    }

    return this.prisma.checklistSubmission.findMany({
      where,
      include: {
        template: {
          select: {
            id: true,
            name: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            name: true,
            plate: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: { answers: true },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async findOneSubmission(id: string, tenantId: string) {
    const submission = await this.prisma.checklistSubmission.findFirst({
      where: { id, tenantId },
      include: {
        template: {
          include: {
            items: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        vehicle: {
          select: {
            id: true,
            name: true,
            plate: true,
            brand: true,
            model: true,
          },
        },
        driver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        answers: {
          include: {
            templateItem: true,
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException('Submissão não encontrada');
    }

    return submission;
  }

  async getStats(tenantId: string) {
    const totalSubmissions = await this.prisma.checklistSubmission.count({
      where: { tenantId },
    });

    const statusCounts = await this.prisma.checklistSubmission.groupBy({
      by: ['overallStatus'],
      where: { tenantId },
      _count: true,
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySubmissions = await this.prisma.checklistSubmission.count({
      where: {
        tenantId,
        submittedAt: {
          gte: today,
        },
      },
    });

    return {
      total: totalSubmissions,
      today: todaySubmissions,
      byStatus: statusCounts.reduce(
        (acc, item) => {
          acc[item.overallStatus] = item._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }
}
