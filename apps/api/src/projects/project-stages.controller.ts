import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ProjectStagesService } from './project-stages.service';
import { UpdateStageDto } from './dto/update-stage.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { PERMISSIONS } from '@storyos/types';

@Controller('projects/:projectId/stages')
@UseGuards(TenantGuard, PermissionGuard)
export class ProjectStagesController {
  constructor(private readonly stages: ProjectStagesService) {}

  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @Get()
  async getHistory(@Param('projectId') projectId: string) {
    return this.stages.getHistory(projectId);
  }

  @RequirePermission(PERMISSIONS.PROJECT_STAGE_UPDATE)
  @Patch()
  async updateStage(@Param('projectId') projectId: string, @Body() dto: UpdateStageDto) {
    return this.stages.updateStage(projectId, dto);
  }
}
