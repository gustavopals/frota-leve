import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'Nome da empresa', example: 'Transportadora ABC' })
  @IsString()
  tenantName: string;

  @ApiPropertyOptional({ description: 'CNPJ da empresa', example: '12.345.678/0001-90' })
  @IsOptional()
  @IsString()
  tenantDocument?: string;

  @ApiProperty({ description: 'Nome do usuário', example: 'João Silva' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Email do usuário', example: 'joao@transportadora.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Senha', example: 'senha123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}
