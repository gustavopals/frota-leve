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
import { FuelService } from './fuel.service';
import { CreateFuelLogDto } from './dto/create-fuel-log.dto';
import { UpdateFuelLogDto } from './dto/update-fuel-log.dto';
import { AuthGuard } from '@nestjs/passport';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('fuel')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('fuel')
export class FuelController {
  constructor(private readonly fuelService: FuelService) {}

  @Post()
  @ApiOperation({ summary: 'Criar novo registro de abastecimento' })
  create(@Body() createFuelLogDto: CreateFuelLogDto, @TenantId() tenantId: string) {
    return this.fuelService.create(createFuelLogDto, tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os abastecimentos' })
  @ApiQuery({ name: 'vehicleId', required: false, description: 'Filtrar por veículo' })
  findAll(@TenantId() tenantId: string, @Query('vehicleId') vehicleId?: string) {
    return this.fuelService.findAll(tenantId, vehicleId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obter estatísticas gerais de abastecimento' })
  getStats(@TenantId() tenantId: string) {
    return this.fuelService.getStats(tenantId);
  }

  @Get('analytics/:vehicleId')
  @ApiOperation({ summary: 'Obter análise de consumo de um veículo' })
  getAnalytics(@Param('vehicleId') vehicleId: string, @TenantId() tenantId: string) {
    return this.fuelService.getAnalytics(vehicleId, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar abastecimento por ID' })
  findOne(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.fuelService.findOne(id, tenantId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar registro de abastecimento' })
  update(
    @Param('id') id: string,
    @Body() updateFuelLogDto: UpdateFuelLogDto,
    @TenantId() tenantId: string,
  ) {
    return this.fuelService.update(id, updateFuelLogDto, tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deletar registro de abastecimento' })
  remove(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.fuelService.remove(id, tenantId);
  }
}
