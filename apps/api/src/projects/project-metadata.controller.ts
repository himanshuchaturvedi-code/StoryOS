import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ProjectMetadataService } from './project-metadata.service';
import { UpsertProjectMetadataDto } from './dto/upsert-metadata.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { PERMISSIONS } from '@storyos/types';

@Controller('projects/:projectId/metadata')
@UseGuards(TenantGuard, PermissionGuard)
export class ProjectMetadataController {
  constructor(private readonly metadata: ProjectMetadataService) {}

  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @Get()
  async get(@Param('projectId') projectId: string) {
    return this.metadata.get(projectId);
  }

  @RequirePermission(PERMISSIONS.PROJECT_METADATA_UPDATE)
  @Patch()
  async upsert(@Param('projectId') projectId: string, @Body() dto: UpsertProjectMetadataDto) {
    return this.metadata.upsert(projectId, dto);
  }
}
