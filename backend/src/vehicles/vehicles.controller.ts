import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { UpdateOdometerDto } from './dto/update-odometer.dto';
import { TenantId } from '../common/decorators/tenant-id.decorator';

@ApiTags('vehicles')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @ApiOperation({ summary: 'Criar novo veículo' })
  @ApiResponse({ status: 201, description: 'Veículo criado com sucesso' })
  create(@TenantId() tenantId: string, @Body() createVehicleDto: CreateVehicleDto) {
    return this.vehiclesService.create(tenantId, createVehicleDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os veículos' })
  @ApiResponse({ status: 200, description: 'Lista de veículos' })
  findAll(
    @TenantId() tenantId: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.vehiclesService.findAll(tenantId, { status, search });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obter estatísticas dos veículos' })
  @ApiResponse({ status: 200, description: 'Estatísticas dos veículos' })
  getStats(@TenantId() tenantId: string) {
    return this.vehiclesService.getStats(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter veículo por ID' })
  @ApiResponse({ status: 200, description: 'Veículo encontrado' })
  @ApiResponse({ status: 404, description: 'Veículo não encontrado' })
  findOne(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.vehiclesService.findOne(tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar veículo (PATCH)' })
  @ApiResponse({ status: 200, description: 'Veículo atualizado com sucesso' })
  @ApiResponse({ status: 404, description: 'Veículo não encontrado' })
  updatePatch(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() updateVehicleDto: UpdateVehicleDto,
  ) {
    return this.vehiclesService.update(tenantId, id, updateVehicleDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar veículo (PUT)' })
  @ApiResponse({ status: 200, description: 'Veículo atualizado com sucesso' })
  @ApiResponse({ status: 404, description: 'Veículo não encontrado' })
  update(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() updateVehicleDto: UpdateVehicleDto,
  ) {
    return this.vehiclesService.update(tenantId, id, updateVehicleDto);
  }

  @Patch(':id/odometer')
  @ApiOperation({ summary: 'Atualizar odômetro do veículo' })
  @ApiResponse({ status: 200, description: 'Odômetro atualizado com sucesso' })
  @ApiResponse({ status: 404, description: 'Veículo não encontrado' })
  updateOdometer(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() updateOdometerDto: UpdateOdometerDto,
  ) {
    return this.vehiclesService.updateOdometer(tenantId, id, updateOdometerDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover veículo' })
  @ApiResponse({ status: 200, description: 'Veículo removido com sucesso' })
  @ApiResponse({ status: 404, description: 'Veículo não encontrado' })
  remove(@TenantId() tenantId: string, @Param('id') id: string) {
    return this.vehiclesService.remove(tenantId, id);
  }
}
