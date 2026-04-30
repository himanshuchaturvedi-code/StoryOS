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
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('projects/:projectId/budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.BUDGET_READ)
  list(@Param('projectId') projectId: string) {
    return this.budgetsService.list(projectId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.BUDGET_CREATE)
  create(@Param('projectId') projectId: string, @Body() dto: CreateBudgetDto) {
    return this.budgetsService.create(projectId, dto);
  }

  @Get(':budgetId')
  @RequirePermission(PERMISSIONS.BUDGET_READ)
  findOne(@Param('budgetId') budgetId: string) {
    return this.budgetsService.findById(budgetId);
  }

  @Patch(':budgetId')
  @RequirePermission(PERMISSIONS.BUDGET_UPDATE)
  update(@Param('budgetId') budgetId: string, @Body() dto: UpdateBudgetDto) {
    return this.budgetsService.update(budgetId, dto);
  }

  @Delete(':budgetId')
  @RequirePermission(PERMISSIONS.BUDGET_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('budgetId') budgetId: string) {
    return this.budgetsService.remove(budgetId);
  }
}
