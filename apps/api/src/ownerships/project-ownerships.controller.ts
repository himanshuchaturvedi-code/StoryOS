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
import { ProjectOwnershipsService } from './ownerships.service';
import { CreateProjectOwnershipDto } from './dto/create-project-ownership.dto';
import { UpdateProjectOwnershipDto } from './dto/update-project-ownership.dto';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('projects/:projectId/ownerships')
export class ProjectOwnershipsController {
  constructor(private readonly service: ProjectOwnershipsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.OWNERSHIP_READ)
  list(@Param('projectId') projectId: string) {
    return this.service.list(projectId);
  }

  @Get('current')
  @RequirePermission(PERMISSIONS.OWNERSHIP_READ)
  current(@Param('projectId') projectId: string) {
    return this.service.currentOwners(projectId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.OWNERSHIP_CREATE)
  create(@Param('projectId') projectId: string, @Body() dto: CreateProjectOwnershipDto) {
    return this.service.create(projectId, dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.OWNERSHIP_UPDATE)
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProjectOwnershipDto,
  ) {
    return this.service.update(projectId, id, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.OWNERSHIP_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.service.remove(projectId, id);
  }
}
