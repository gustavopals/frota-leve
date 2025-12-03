import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, IsEnum, Min, Max } from 'class-validator';
import { VehicleStatus } from '@prisma/client';

export class CreateVehicleDto {
  @ApiProperty({ description: 'Nome/descrição do veículo', example: 'Hilux Prata' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Placa do veículo', example: 'ABC-1234' })
  @IsString()
  @IsNotEmpty()
  plate: string;

  @ApiPropertyOptional({ description: 'RENAVAM', example: '12345678901' })
  @IsString()
  @IsOptional()
  renavam?: string;

  @ApiPropertyOptional({ description: 'Número do chassi', example: '9BWZZZ377VT004251' })
  @IsString()
  @IsOptional()
  chassisNumber?: string;

  @ApiPropertyOptional({ description: 'Tipo do veículo', example: 'Caminhonete' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: 'Marca', example: 'Toyota' })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({ description: 'Modelo', example: 'Hilux SR' })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({ description: 'Ano do veículo', example: 2020 })
  @IsInt()
  @IsOptional()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  year?: number;

  @ApiPropertyOptional({ description: 'Cor do veículo', example: 'Prata' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ description: 'Tipo de combustível', example: 'Diesel' })
  @IsString()
  @IsOptional()
  fuelType?: string;

  @ApiPropertyOptional({ description: 'Quilometragem atual (km)', example: 45000 })
  @IsOptional()
  currentKm?: number;

  @ApiPropertyOptional({ description: 'Odômetro atual (km)', example: 45000 })
  @IsOptional()
  currentOdometer?: number;

  @ApiPropertyOptional({
    description: 'Status do veículo',
    enum: VehicleStatus,
    example: VehicleStatus.ACTIVE,
  })
  @IsEnum(VehicleStatus)
  @IsOptional()
  status?: VehicleStatus;
}
