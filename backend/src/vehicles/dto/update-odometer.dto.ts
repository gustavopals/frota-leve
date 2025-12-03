import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class UpdateOdometerDto {
  @ApiProperty({ description: 'Novo valor do odômetro (km)', example: 45500 })
  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  currentOdometer: number;
}
