import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '@storyos/types';
import { ExpenseFactsService } from './expense-facts.service';
import { CreateExpenseFactDto } from './dto/create-expense-fact.dto';
import { UpdateExpenseFactDto } from './dto/update-expense-fact.dto';
import { DeriveExpenseFactsDto } from './dto/derive-expense-facts.dto';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('projects/:projectId/expense-facts')
export class ExpenseFactsController {
  constructor(private readonly expenseFactsService: ExpenseFactsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.EXPENSE_FACT_READ)
  list(
    @Param('projectId') projectId: string,
    @Query('vendorId') vendorId?: string,
    @Query('personId') personId?: string,
    @Query('locationId') locationId?: string,
    @Query('productionPhaseId') productionPhaseId?: string,
    @Query('labourFlag') labourFlag?: string,
    @Query('serviceFlag') serviceFlag?: string,
  ) {
    return this.expenseFactsService.list(projectId, {
      vendorId,
      personId,
      locationId,
      productionPhaseId,
      labourFlag,
      serviceFlag,
    });
  }

  @Get('summary')
  @RequirePermission(PERMISSIONS.EXPENSE_FACT_READ)
  summary(@Param('projectId') projectId: string) {
    return this.expenseFactsService.summary(projectId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.EXPENSE_FACT_CREATE)
  create(@Param('projectId') projectId: string, @Body() dto: CreateExpenseFactDto) {
    return this.expenseFactsService.create(projectId, dto);
  }

  @Post('derive')
  @RequirePermission(PERMISSIONS.EXPENSE_FACT_CREATE)
  derive(@Param('projectId') projectId: string, @Body() dto: DeriveExpenseFactsDto) {
    return this.expenseFactsService.deriveFromActualLines(projectId, dto);
  }

  @Get(':expenseFactId')
  @RequirePermission(PERMISSIONS.EXPENSE_FACT_READ)
  findOne(
    @Param('projectId') projectId: string,
    @Param('expenseFactId') expenseFactId: string,
  ) {
    return this.expenseFactsService.findById(projectId, expenseFactId);
  }

  @Patch(':expenseFactId')
  @RequirePermission(PERMISSIONS.EXPENSE_FACT_UPDATE)
  update(
    @Param('projectId') projectId: string,
    @Param('expenseFactId') expenseFactId: string,
    @Body() dto: UpdateExpenseFactDto,
  ) {
    return this.expenseFactsService.update(projectId, expenseFactId, dto);
  }

  @Delete(':expenseFactId')
  @RequirePermission(PERMISSIONS.EXPENSE_FACT_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('projectId') projectId: string,
    @Param('expenseFactId') expenseFactId: string,
  ) {
    return this.expenseFactsService.remove(projectId, expenseFactId);
  }
}
