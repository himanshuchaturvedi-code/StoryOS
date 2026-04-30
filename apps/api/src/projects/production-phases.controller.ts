import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProductionPhasesService } from './production-phases.service';
import { CreateProductionPhaseDto } from './dto/create-phase.dto';
import { UpdateProductionPhaseDto } from './dto/update-phase.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { PERMISSIONS } from '@storyos/types';

@Controller('projects/:projectId/phases')
@UseGuards(TenantGuard, PermissionGuard)
export class ProductionPhasesController {
  constructor(private readonly phases: ProductionPhasesService) {}

  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @Get()
  async list(@Param('projectId') projectId: string) {
    return this.phases.list(projectId);
  }

  @RequirePermission(PERMISSIONS.PROJECT_PHASE_MANAGE)
  @Post()
  async create(@Param('projectId') projectId: string, @Body() dto: CreateProductionPhaseDto) {
    return this.phases.create(projectId, dto);
  }

  @RequirePermission(PERMISSIONS.PROJECT_PHASE_MANAGE)
  @Patch(':phaseId')
  async update(
    @Param('projectId') projectId: string,
    @Param('phaseId') phaseId: string,
    @Body() dto: UpdateProductionPhaseDto,
  ) {
    return this.phases.update(projectId, phaseId, dto);
  }

  @RequirePermission(PERMISSIONS.PROJECT_PHASE_MANAGE)
  @Delete(':phaseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('projectId') projectId: string, @Param('phaseId') phaseId: string) {
    await this.phases.remove(projectId, phaseId);
  }
}
