import { IsString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum MaintenanceTriggerType {
  KM = 'KM',
  TIME = 'TIME',
  BOTH = 'BOTH',
}

export class CreateMaintenancePlanDto {
  @ApiProperty({ example: 'Troca de Óleo' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Troca de óleo e filtro do motor' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: MaintenanceTriggerType, example: MaintenanceTriggerType.BOTH })
  @IsEnum(MaintenanceTriggerType)
  triggerType: MaintenanceTriggerType;

  @ApiPropertyOptional({ example: 10000, description: 'Intervalo em quilômetros' })
  @IsInt()
  @Min(1)
  @IsOptional()
  intervalKm?: number;

  @ApiPropertyOptional({ example: 180, description: 'Intervalo em dias' })
  @IsInt()
  @Min(1)
  @IsOptional()
  intervalDays?: number;

  @ApiPropertyOptional({ example: 250.0, description: 'Custo estimado' })
  @IsOptional()
  estimatedCost?: number;
}
