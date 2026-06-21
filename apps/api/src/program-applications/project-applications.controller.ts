import { Controller, Get, Param, UseGuards, Post, Body } from '@nestjs/common';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '@storyos/types';
import { ProgramApplicationsService } from './program-applications.service';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('projects/:projectId/applications')
export class ProjectApplicationsController {
  constructor(private readonly programApplicationsService: ProgramApplicationsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PROGRAM_APPLICATION_READ)
  findAll(@Param('projectId') projectId: string) {
    return this.programApplicationsService.findAllByProject(projectId);
  }

  @Get(':applicationId')
  @RequirePermission(PERMISSIONS.PROGRAM_APPLICATION_READ)
  findOne(
    @Param('projectId') projectId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.programApplicationsService.findById(projectId, applicationId);
  }

  @Post('initiate')
  @RequirePermission(PERMISSIONS.PROGRAM_APPLICATION_CREATE)
  initiate(
    @Param('projectId') projectId: string,
    @Body() dto: { programVersionId: string },
  ) {
    return this.programApplicationsService.initiateApplication(projectId, dto.programVersionId);
  }
}
