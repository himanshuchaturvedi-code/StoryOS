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
import { FinancePlansService } from './finance-plans.service';
import { CreateFinancePlanDto } from './dto/create-finance-plan.dto';
import { UpdateFinancePlanDto } from './dto/update-finance-plan.dto';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('projects/:projectId/finance-plans')
export class FinancePlansController {
  constructor(private readonly plansService: FinancePlansService) {}

  @Get()
  @RequirePermission(PERMISSIONS.FINANCE_PLAN_READ)
  list(@Param('projectId') projectId: string) {
    return this.plansService.list(projectId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.FINANCE_PLAN_CREATE)
  create(@Param('projectId') projectId: string, @Body() dto: CreateFinancePlanDto) {
    return this.plansService.create(projectId, dto);
  }

  @Get(':planId')
  @RequirePermission(PERMISSIONS.FINANCE_PLAN_READ)
  findOne(@Param('planId') planId: string) {
    return this.plansService.findById(planId);
  }

  @Get(':planId/summary')
  @RequirePermission(PERMISSIONS.FINANCE_PLAN_READ)
  summary(@Param('planId') planId: string) {
    return this.plansService.summary(planId);
  }

  @Patch(':planId')
  @RequirePermission(PERMISSIONS.FINANCE_PLAN_UPDATE)
  update(@Param('planId') planId: string, @Body() dto: UpdateFinancePlanDto) {
    return this.plansService.update(planId, dto);
  }

  @Delete(':planId')
  @RequirePermission(PERMISSIONS.FINANCE_PLAN_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('planId') planId: string) {
    return this.plansService.remove(planId);
  }
}
