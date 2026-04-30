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
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { PERMISSIONS } from '@storyos/types';

@Controller('projects')
@UseGuards(TenantGuard, PermissionGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @Get()
  async list() {
    return this.projects.list();
  }

  @RequirePermission(PERMISSIONS.PROJECT_CREATE)
  @Post()
  async create(@Body() dto: CreateProjectDto) {
    return this.projects.create(dto);
  }

  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @Get(':projectId')
  async getOne(@Param('projectId') projectId: string) {
    return this.projects.findById(projectId);
  }

  @RequirePermission(PERMISSIONS.PROJECT_UPDATE)
  @Patch(':projectId')
  async update(@Param('projectId') projectId: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(projectId, dto);
  }

  @RequirePermission(PERMISSIONS.PROJECT_DELETE)
  @Delete(':projectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('projectId') projectId: string) {
    await this.projects.softDelete(projectId);
  }
}
