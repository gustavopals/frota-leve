import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ChecklistTemplateItemDto {
  @ApiProperty({ description: 'Rótulo do item' })
  @IsString()
  label: string;

  @ApiProperty({ description: 'Tipo do campo', enum: ['BOOLEAN', 'TEXT', 'NUMBER', 'SELECT'] })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Configuração adicional (JSON)', required: false })
  @IsOptional()
  config?: any;

  @ApiProperty({ description: 'Ordem de exibição' })
  @IsOptional()
  sortOrder?: number;
}

export class CreateChecklistTemplateDto {
  @ApiProperty({ description: 'Nome do template' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Tipo de veículo (opcional)', required: false })
  @IsString()
  @IsOptional()
  vehicleType?: string;

  @ApiProperty({ description: 'Template ativo', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'Itens do checklist', type: [ChecklistTemplateItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistTemplateItemDto)
  items: ChecklistTemplateItemDto[];
}
