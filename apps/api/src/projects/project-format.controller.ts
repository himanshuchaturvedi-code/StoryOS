import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ProjectFormatService } from './project-format.service';
import { UpsertProjectFormatDto } from './dto/upsert-format.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { PERMISSIONS } from '@storyos/types';

@Controller('projects/:projectId/format')
@UseGuards(TenantGuard, PermissionGuard)
export class ProjectFormatController {
  constructor(private readonly format: ProjectFormatService) {}

  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @Get()
  async get(@Param('projectId') projectId: string) {
    return this.format.get(projectId);
  }

  @RequirePermission(PERMISSIONS.PROJECT_FORMAT_UPDATE)
  @Patch()
  async upsert(@Param('projectId') projectId: string, @Body() dto: UpsertProjectFormatDto) {
    return this.format.upsert(projectId, dto);
  }
}
