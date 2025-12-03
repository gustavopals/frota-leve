import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class ChecklistAnswerDto {
  @ApiProperty({ description: 'ID do item do template' })
  @IsUUID()
  templateItemId: string;

  @ApiProperty({ description: 'Valor da resposta' })
  @IsString()
  value: string;
}

export class CreateChecklistSubmissionDto {
  @ApiProperty({ description: 'ID do template' })
  @IsUUID()
  templateId: string;

  @ApiProperty({ description: 'ID do veículo' })
  @IsUUID()
  vehicleId: string;

  @ApiProperty({ description: 'Status geral', enum: ['OK', 'ALERT', 'CRITICAL'], required: false })
  @IsString()
  @IsOptional()
  overallStatus?: string;

  @ApiProperty({ description: 'Respostas do checklist', type: [ChecklistAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistAnswerDto)
  answers: ChecklistAnswerDto[];
}
