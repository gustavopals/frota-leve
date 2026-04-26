import { z } from 'zod';
import { VehicleCategory, VehicleStatus, FuelType } from '@frota-leve/database';
import { prisma } from '../../../config/database';
import type { AITool } from './types';

const inputSchema = z.object({
  status: z.nativeEnum(VehicleStatus).optional(),
  category: z.nativeEnum(VehicleCategory).optional(),
  fuelType: z.nativeEnum(FuelType).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const listVehiclesByFilterTool: AITool<typeof inputSchema> = {
  name: 'listVehiclesByFilter',
  description:
    'Lista veículos da frota filtrados por status, categoria ou tipo de combustível. ' +
    'Use para perguntas como "quais caminhões estão em manutenção?" ou "quantos veículos a diesel temos?".',
  zodSchema: inputSchema,
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: Object.values(VehicleStatus),
        description: 'Status do veículo.',
      },
      category: {
        type: 'string',
        enum: Object.values(VehicleCategory),
        description: 'Categoria (LIGHT, HEAVY, MOTORCYCLE, MACHINERY).',
      },
      fuelType: {
        type: 'string',
        enum: Object.values(FuelType),
        description: 'Combustível.',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        default: 20,
      },
    },
    additionalProperties: false,
  },
  execute: async (input, ctx) => {
    const where = {
      tenantId: ctx.tenantId,
      ...(input.status ? { status: input.status } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.fuelType ? { fuelType: input.fuelType } : {}),
    };

    const [total, vehicles] = await Promise.all([
      prisma.vehicle.count({ where }),
      prisma.vehicle.findMany({
        where,
        take: input.limit,
        orderBy: { plate: 'asc' },
        select: {
          id: true,
          plate: true,
          brand: true,
          model: true,
          year: true,
          status: true,
          category: true,
          fuelType: true,
          currentMileage: true,
        },
      }),
    ]);

    return { total, returned: vehicles.length, vehicles };
  },
};
