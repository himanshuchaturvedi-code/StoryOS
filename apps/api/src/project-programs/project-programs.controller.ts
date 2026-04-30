import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '@storyos/types';
import { ProjectProgramsService } from './project-programs.service';
import { CreateProjectProgramDto } from './dto/create-project-program.dto';
import { UpdateProjectProgramDto } from './dto/update-project-program.dto';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('projects/:projectId/programs')
export class ProjectProgramsController {
  constructor(private readonly projectProgramsService: ProjectProgramsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PROJECT_PROGRAM_READ)
  list(@Param('projectId') projectId: string) {
    return this.projectProgramsService.list(projectId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PROJECT_PROGRAM_CREATE)
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectProgramDto,
  ) {
    return this.projectProgramsService.create(projectId, dto);
  }

  @Get(':projectProgramId')
  @RequirePermission(PERMISSIONS.PROJECT_PROGRAM_READ)
  findOne(
    @Param('projectId') projectId: string,
    @Param('projectProgramId') projectProgramId: string,
  ) {
    return this.projectProgramsService.findById(projectId, projectProgramId);
  }

  @Patch(':projectProgramId')
  @RequirePermission(PERMISSIONS.PROJECT_PROGRAM_UPDATE)
  update(
    @Param('projectId') projectId: string,
    @Param('projectProgramId') projectProgramId: string,
    @Body() dto: UpdateProjectProgramDto,
  ) {
    return this.projectProgramsService.update(projectId, projectProgramId, dto);
  }

  @Delete(':projectProgramId')
  @RequirePermission(PERMISSIONS.PROJECT_PROGRAM_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('projectId') projectId: string,
    @Param('projectProgramId') projectProgramId: string,
  ) {
    return this.projectProgramsService.remove(projectId, projectProgramId);
  }
}
