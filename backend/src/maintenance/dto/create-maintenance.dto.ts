import { IsString, IsUUID, IsDateString, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMaintenanceDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  vehicleId: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174001' })
  @IsUUID()
  @IsOptional()
  maintenancePlanId?: string;

  @ApiProperty({ example: '2024-12-03T10:00:00Z' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'Troca de óleo e filtro' })
  @IsString()
  serviceType: string;

  @ApiPropertyOptional({ example: 'Troca de óleo sintético 5W30 e filtro original' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 45000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  odometer?: number;

  @ApiProperty({ example: 250.50 })
  @IsNumber()
  @Min(0)
  cost: number;

  @ApiPropertyOptional({ example: 'Oficina do João' })
  @IsString()
  @IsOptional()
  provider?: string;

  @ApiPropertyOptional({ example: 'Substituído filtro e óleo' })
  @IsString()
  @IsOptional()
  notes?: string;
}
