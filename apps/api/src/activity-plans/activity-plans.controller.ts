import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PERMISSIONS } from '@storyos/types';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { CreateActivityPlanDto } from './dto/create-activity-plan.dto';
import { UpdateActivityPlanDto } from './dto/update-activity-plan.dto';
import { ActivityPlansService } from './activity-plans.service';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('projects/:projectId/activity-plans')
export class ActivityPlansController {
  constructor(private readonly activityPlans: ActivityPlansService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PROJECT_READ)
  list(@Param('projectId') projectId: string) {
    return this.activityPlans.list(projectId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PROJECT_UPDATE)
  create(@Param('projectId') projectId: string, @Body() dto: CreateActivityPlanDto) {
    return this.activityPlans.create(projectId, dto);
  }

  @Patch(':activityPlanId')
  @RequirePermission(PERMISSIONS.PROJECT_UPDATE)
  update(
    @Param('projectId') projectId: string,
    @Param('activityPlanId') activityPlanId: string,
    @Body() dto: UpdateActivityPlanDto,
  ) {
    return this.activityPlans.update(projectId, activityPlanId, dto);
  }

  @Delete(':activityPlanId')
  @RequirePermission(PERMISSIONS.PROJECT_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('projectId') projectId: string,
    @Param('activityPlanId') activityPlanId: string,
  ) {
    await this.activityPlans.remove(projectId, activityPlanId);
  }
}
