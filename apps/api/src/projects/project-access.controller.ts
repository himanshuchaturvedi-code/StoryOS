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
import { ProjectAccessService } from './project-access.service';
import { GrantProjectAccessDto } from './dto/grant-access.dto';
import { UpdateProjectAccessRoleDto } from './dto/update-access-role.dto';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { PERMISSIONS } from '@storyos/types';

@Controller('projects/:projectId/access')
@UseGuards(TenantGuard, PermissionGuard)
export class ProjectAccessController {
  constructor(private readonly access: ProjectAccessService) {}

  @RequirePermission(PERMISSIONS.PROJECT_READ)
  @Get()
  async list(@Param('projectId') projectId: string) {
    return this.access.list(projectId);
  }

  @RequirePermission(PERMISSIONS.PROJECT_MANAGE_ACCESS)
  @Post()
  async grant(@Param('projectId') projectId: string, @Body() dto: GrantProjectAccessDto) {
    return this.access.grant(projectId, dto);
  }

  @RequirePermission(PERMISSIONS.PROJECT_MANAGE_ACCESS)
  @Patch(':userId')
  async updateRole(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateProjectAccessRoleDto,
  ) {
    return this.access.updateRole(projectId, userId, dto.role);
  }

  @RequirePermission(PERMISSIONS.PROJECT_MANAGE_ACCESS)
  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(@Param('projectId') projectId: string, @Param('userId') userId: string) {
    await this.access.revoke(projectId, userId);
  }
}
