import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { TenantId } from '../common/decorators';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Obter informações da empresa atual' })
  async getCurrentTenant(@TenantId() tenantId: string) {
    return this.tenantsService.findOne(tenantId);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Obter configurações da empresa' })
  async getSettings(@TenantId() tenantId: string) {
    return this.tenantsService.getSettings(tenantId);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Atualizar configurações da empresa' })
  async updateSettings(@TenantId() tenantId: string, @Body() preferences: any) {
    return this.tenantsService.updateSettings(tenantId, preferences);
  }
}
