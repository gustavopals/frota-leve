import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'Email do usuário', example: 'admin@demo.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Senha', example: 'admin123' })
  @IsString()
  password: string;
}
