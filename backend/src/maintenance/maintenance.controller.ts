import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';
import { CreateMaintenancePlanDto } from './dto/create-maintenance-plan.dto';
import { UpdateMaintenancePlanDto } from './dto/update-maintenance-plan.dto';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@ApiTags('Maintenance')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  // ==================== MAINTENANCE PLANS ====================

  @Post('plans')
  @ApiOperation({ summary: 'Criar plano de manutenção' })
  createPlan(@TenantId() tenantId: string, @Body() dto: CreateMaintenancePlanDto) {
    return this.maintenanceService.createPlan(tenantId, dto);
  }

  @Get('plans')
  @ApiOperation({ summary: 'Listar planos de manutenção' })
  findAllPlans(@TenantId() tenantId: string) {
    return this.maintenanceService.findAllPlans(tenantId);
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Obter plano de manutenção' })
  findOnePlan(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.maintenanceService.findOnePlan(tenantId, id);
  }

  @Patch('plans/:id')
  @ApiOperation({ summary: 'Atualizar plano de manutenção' })
  updatePlan(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMaintenancePlanDto,
  ) {
    return this.maintenanceService.updatePlan(tenantId, id, dto);
  }

  @Delete('plans/:id')
  @ApiOperation({ summary: 'Remover plano de manutenção' })
  removePlan(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.maintenanceService.removePlan(tenantId, id);
  }

  // ==================== MAINTENANCES ====================

  @Post()
  @ApiOperation({ summary: 'Registrar manutenção' })
  create(@TenantId() tenantId: string, @Body() dto: CreateMaintenanceDto) {
    return this.maintenanceService.create(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar manutenções' })
  @ApiQuery({ name: 'vehicleId', required: false })
  findAll(@TenantId() tenantId: string, @Query('vehicleId') vehicleId?: string) {
    return this.maintenanceService.findAll(tenantId, vehicleId);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'Manutenções próximas/previstas' })
  getUpcoming(@TenantId() tenantId: string) {
    return this.maintenanceService.getUpcoming(tenantId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de manutenções' })
  getStats(@TenantId() tenantId: string) {
    return this.maintenanceService.getStats(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter manutenção' })
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.maintenanceService.findOne(tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar manutenção' })
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceDto,
  ) {
    return this.maintenanceService.update(tenantId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover manutenção' })
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.maintenanceService.remove(tenantId, id);
  }
}
