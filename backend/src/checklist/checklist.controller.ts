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
import { ChecklistService } from './checklist.service';
import { CreateChecklistTemplateDto } from './dto/create-template.dto';
import { UpdateChecklistTemplateDto } from './dto/update-template.dto';
import { CreateChecklistSubmissionDto } from './dto/create-submission.dto';
import { AuthGuard } from '@nestjs/passport';
import { TenantId } from '../common/decorators/tenant-id.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('checklist')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('checklist')
export class ChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  // ===== TEMPLATES =====

  @Post('templates')
  @ApiOperation({ summary: 'Criar template de checklist' })
  createTemplate(@Body() dto: CreateChecklistTemplateDto, @TenantId() tenantId: string) {
    return this.checklistService.createTemplate(dto, tenantId);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Listar todos os templates' })
  findAllTemplates(@TenantId() tenantId: string) {
    return this.checklistService.findAllTemplates(tenantId);
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Buscar template por ID' })
  findOneTemplate(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.checklistService.findOneTemplate(id, tenantId);
  }

  @Patch('templates/:id')
  @ApiOperation({ summary: 'Atualizar template' })
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateChecklistTemplateDto,
    @TenantId() tenantId: string,
  ) {
    return this.checklistService.updateTemplate(id, dto, tenantId);
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Deletar template' })
  removeTemplate(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.checklistService.removeTemplate(id, tenantId);
  }

  // ===== SUBMISSIONS =====

  @Post('submissions')
  @ApiOperation({ summary: 'Criar submissão de checklist' })
  createSubmission(
    @Body() dto: CreateChecklistSubmissionDto,
    @CurrentUser() user: { id: string },
    @TenantId() tenantId: string,
  ) {
    return this.checklistService.createSubmission(dto, user.id, tenantId);
  }

  @Get('submissions')
  @ApiOperation({ summary: 'Listar todas as submissões' })
  @ApiQuery({ name: 'vehicleId', required: false })
  @ApiQuery({ name: 'driverId', required: false })
  findAllSubmissions(
    @TenantId() tenantId: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('driverId') driverId?: string,
  ) {
    return this.checklistService.findAllSubmissions(tenantId, vehicleId, driverId);
  }

  @Get('submissions/stats')
  @ApiOperation({ summary: 'Obter estatísticas de checklists' })
  getStats(@TenantId() tenantId: string) {
    return this.checklistService.getStats(tenantId);
  }

  @Get('submissions/:id')
  @ApiOperation({ summary: 'Buscar submissão por ID' })
  findOneSubmission(@Param('id') id: string, @TenantId() tenantId: string) {
    return this.checklistService.findOneSubmission(id, tenantId);
  }
}
