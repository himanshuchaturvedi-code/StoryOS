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
import { BudgetVersionsService } from './budget-versions.service';
import { CreateBudgetVersionDto } from './dto/create-budget-version.dto';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('budgets/:budgetId/versions')
export class BudgetVersionsController {
  constructor(private readonly versionsService: BudgetVersionsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.BUDGET_VERSION_READ)
  list(@Param('budgetId') budgetId: string) {
    return this.versionsService.list(budgetId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.BUDGET_VERSION_CREATE)
  create(@Param('budgetId') budgetId: string, @Body() dto: CreateBudgetVersionDto) {
    return this.versionsService.create(budgetId, dto);
  }

  @Get(':versionId')
  @RequirePermission(PERMISSIONS.BUDGET_VERSION_READ)
  findOne(@Param('budgetId') budgetId: string, @Param('versionId') versionId: string) {
    return this.versionsService.findById(budgetId, versionId);
  }

  @Patch(':versionId/lock')
  @RequirePermission(PERMISSIONS.BUDGET_VERSION_LOCK)
  lock(@Param('budgetId') budgetId: string, @Param('versionId') versionId: string) {
    return this.versionsService.lock(budgetId, versionId);
  }

  @Patch(':versionId/unlock')
  @RequirePermission(PERMISSIONS.BUDGET_VERSION_LOCK)
  unlock(@Param('budgetId') budgetId: string, @Param('versionId') versionId: string) {
    return this.versionsService.unlock(budgetId, versionId);
  }

  @Delete(':versionId')
  @RequirePermission(PERMISSIONS.BUDGET_VERSION_CREATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('budgetId') budgetId: string, @Param('versionId') versionId: string) {
    return this.versionsService.remove(budgetId, versionId);
  }
}
