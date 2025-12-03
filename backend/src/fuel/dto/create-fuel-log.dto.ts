import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsDateString, IsString, IsNumber, Min, IsOptional } from 'class-validator';

export class CreateFuelLogDto {
  @ApiProperty({ description: 'ID do veículo' })
  @IsUUID()
  vehicleId: string;

  @ApiProperty({ description: 'ID do motorista (opcional)', required: false })
  @IsUUID()
  @IsOptional()
  driverId?: string;

  @ApiProperty({ description: 'Data do abastecimento' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Nome do posto' })
  @IsString()
  station: string;

  @ApiProperty({ description: 'Quantidade de litros' })
  @IsNumber()
  @Min(0)
  liters: number;

  @ApiProperty({ description: 'Valor total pago' })
  @IsNumber()
  @Min(0)
  totalValue: number;

  @ApiProperty({ description: 'Quilometragem no momento do abastecimento' })
  @IsNumber()
  @Min(0)
  odometer: number;

  @ApiProperty({ description: 'Observações adicionais (opcional)', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
