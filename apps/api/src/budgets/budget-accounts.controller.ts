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
import { BudgetAccountsService } from './budget-accounts.service';
import { CreateBudgetAccountDto } from './dto/create-budget-account.dto';
import { UpdateBudgetAccountDto } from './dto/update-budget-account.dto';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('budgets/:budgetId/accounts')
export class BudgetAccountsController {
  constructor(private readonly accountsService: BudgetAccountsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.BUDGET_READ)
  list(@Param('budgetId') budgetId: string) {
    return this.accountsService.list(budgetId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.BUDGET_UPDATE)
  create(@Param('budgetId') budgetId: string, @Body() dto: CreateBudgetAccountDto) {
    return this.accountsService.create(budgetId, dto);
  }

  @Patch(':accountId')
  @RequirePermission(PERMISSIONS.BUDGET_UPDATE)
  update(
    @Param('budgetId') budgetId: string,
    @Param('accountId') accountId: string,
    @Body() dto: UpdateBudgetAccountDto,
  ) {
    return this.accountsService.update(budgetId, accountId, dto);
  }

  @Delete(':accountId')
  @RequirePermission(PERMISSIONS.BUDGET_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('budgetId') budgetId: string, @Param('accountId') accountId: string) {
    return this.accountsService.remove(budgetId, accountId);
  }
}
