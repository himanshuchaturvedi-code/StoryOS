import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PERMISSIONS } from '@storyos/types';

import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

import { EstimateGrantDto } from './dto/estimate-grant.dto';
import { GrantEstimatorService } from './grant-estimator.service';

/**
 * POST /api/grants/estimate
 *
 * Returns monetary grant estimates ($) for a single province's calculator
 * stack. Eligibility (PASS/FAIL) remains the responsibility of the existing
 * `estimate-preview` flow — this endpoint is intentionally orthogonal so the
 * two response shapes never collide.
 */
@UseGuards(TenantGuard, PermissionGuard)
@Controller('grants')
export class GrantEstimatorController {
  constructor(private readonly service: GrantEstimatorService) {}

  @Post('estimate')
  @RequirePermission(PERMISSIONS.ASSESSMENT_READ)
  estimate(@Body() dto: EstimateGrantDto) {
    return this.service.estimate(dto);
  }
}
