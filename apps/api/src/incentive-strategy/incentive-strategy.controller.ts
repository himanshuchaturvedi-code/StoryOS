import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@storyos/types';

import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { IncentiveStrategyService } from './incentive-strategy.service';
import type { IncentiveStrategyResponse } from './incentive-strategy.service';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('projects/:projectId/incentive-strategy')
export class IncentiveStrategyController {
  constructor(private readonly service: IncentiveStrategyService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ASSESSMENT_READ)
  getProjectStrategy(
    @Param('projectId') projectId: string,
    @Query('source') source?: string,
  ): Promise<IncentiveStrategyResponse> {
    return this.service.getProjectStrategy(projectId, source);
  }
}
