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
import { ProjectMilestonesService } from './project-milestones.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { PERMISSIONS } from '@storyos/types';

@Controller('projects/:projectId/milestones')
@UseGuards(TenantGuard, PermissionGuard)
export class ProjectMilestonesController {
  constructor(private readonly milestones: ProjectMilestonesService) {}

  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @Get()
  async list(@Param('projectId') projectId: string) {
    return this.milestones.list(projectId);
  }

  @RequirePermission(PERMISSIONS.PROJECT_MILESTONE_MANAGE)
  @Post()
  async create(@Param('projectId') projectId: string, @Body() dto: CreateMilestoneDto) {
    return this.milestones.create(projectId, dto);
  }

  @RequirePermission(PERMISSIONS.PROJECT_MILESTONE_MANAGE)
  @Patch(':milestoneId')
  async update(
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.milestones.update(projectId, milestoneId, dto);
  }

  @RequirePermission(PERMISSIONS.PROJECT_MILESTONE_MANAGE)
  @Delete(':milestoneId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
  ) {
    await this.milestones.remove(projectId, milestoneId);
  }
}
