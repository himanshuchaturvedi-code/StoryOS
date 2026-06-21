import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '@storyos/types';
import { ProgramApplicationsService } from './program-applications.service';
import { CreateProgramApplicationDto } from './dto/create-program-application.dto';
import { UpdateProgramApplicationDto } from './dto/update-program-application.dto';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('projects/:projectId/programs/:projectProgramId/application')
export class ProgramApplicationsController {
  constructor(private readonly programApplicationsService: ProgramApplicationsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PROGRAM_APPLICATION_READ)
  findOne(
    @Param('projectId') projectId: string,
    @Param('projectProgramId') projectProgramId: string,
  ) {
    return this.programApplicationsService.findByProjectProgram(projectId, projectProgramId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PROGRAM_APPLICATION_CREATE)
  create(
    @Param('projectId') projectId: string,
    @Param('projectProgramId') projectProgramId: string,
    @Body() dto: CreateProgramApplicationDto,
  ) {
    return this.programApplicationsService.create(projectId, projectProgramId, dto);
  }

  @Patch()
  @RequirePermission(PERMISSIONS.PROGRAM_APPLICATION_UPDATE)
  update(
    @Param('projectId') projectId: string,
    @Param('projectProgramId') projectProgramId: string,
    @Body() dto: UpdateProgramApplicationDto,
  ) {
    return this.programApplicationsService.update(projectId, projectProgramId, dto);
  }
}
