import { Controller, Get, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { PERMISSIONS } from '@storyos/types';

import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { DerivedRolesService } from './derived-roles.service';
import type { DerivedRolesResponse } from '@storyos/types';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('projects/:projectId/derived-roles')
export class DerivedRolesController {
  constructor(private readonly service: DerivedRolesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ASSESSMENT_READ)
  getDerivedRoles(
    @Param('projectId') projectId: string,
    @Query('budgetVersionId') budgetVersionId?: string,
  ): Promise<DerivedRolesResponse> {
    if (!budgetVersionId) {
      throw new BadRequestException(
        'budgetVersionId query parameter is required',
      );
    }
    return this.service.getDerivedRoles(projectId, budgetVersionId);
  }
}
