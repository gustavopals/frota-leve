import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    return this.prisma.tenant.findUnique({
      where: { id },
      include: {
        settings: true,
      },
    });
  }

  async update(id: string, data: { name?: string; document?: string }) {
    return this.prisma.tenant.update({
      where: { id },
      data,
    });
  }

  async getSettings(tenantId: string) {
    let settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
    });

    if (!settings) {
      settings = await this.prisma.tenantSettings.create({
        data: {
          tenantId,
          preferences: {},
        },
      });
    }

    return settings;
  }

  async updateSettings(tenantId: string, preferences: any) {
    return this.prisma.tenantSettings.upsert({
      where: { tenantId },
      update: { preferences },
      create: { tenantId, preferences },
    });
  }
}
