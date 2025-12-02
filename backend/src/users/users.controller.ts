import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { TenantId, Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '@prisma/client';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.ADMIN_EMPRESA, UserRole.GESTOR_FROTA)
  @ApiOperation({ summary: 'Criar novo usuário' })
  create(@TenantId() tenantId: string, @Body() createUserDto: CreateUserDto) {
    return this.usersService.create(tenantId, createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os usuários da empresa' })
  findAll(@TenantId() tenantId: string) {
    return this.usersService.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter um usuário específico' })
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.usersService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN_EMPRESA, UserRole.GESTOR_FROTA)
  @ApiOperation({ summary: 'Atualizar usuário' })
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(tenantId, id, updateUserDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN_EMPRESA)
  @ApiOperation({ summary: 'Remover usuário' })
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.usersService.remove(tenantId, id);
  }
}
