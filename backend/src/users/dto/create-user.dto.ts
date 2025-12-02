import { IsString, IsEmail, IsEnum, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ description: 'Nome do usuário', example: 'João Silva' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Email do usuário', example: 'joao@empresa.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Senha', example: 'senha123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'Perfil do usuário',
    enum: UserRole,
    example: UserRole.MOTORISTA,
  })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({ description: 'Usuário ativo', default: true })
  @IsOptional()
  isActive?: boolean;
}
