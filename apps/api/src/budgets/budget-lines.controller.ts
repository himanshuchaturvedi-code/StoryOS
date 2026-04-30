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
import { BudgetLinesService } from './budget-lines.service';
import { CreateBudgetLineDto } from './dto/create-budget-line.dto';
import { UpdateBudgetLineDto } from './dto/update-budget-line.dto';
import { AnnotateBudgetLineDto } from './dto/annotate-budget-line.dto';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('budgets/:budgetId/versions/:versionId/lines')
export class BudgetLinesController {
  constructor(private readonly linesService: BudgetLinesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.BUDGET_LINE_READ)
  list(@Param('budgetId') budgetId: string, @Param('versionId') versionId: string) {
    return this.linesService.list(budgetId, versionId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.BUDGET_LINE_CREATE)
  create(
    @Param('budgetId') budgetId: string,
    @Param('versionId') versionId: string,
    @Body() dto: CreateBudgetLineDto,
  ) {
    return this.linesService.create(budgetId, versionId, dto);
  }

  @Patch(':lineId')
  @RequirePermission(PERMISSIONS.BUDGET_LINE_UPDATE)
  update(
    @Param('budgetId') budgetId: string,
    @Param('versionId') versionId: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateBudgetLineDto,
  ) {
    return this.linesService.update(budgetId, versionId, lineId, dto);
  }

  @Patch(':lineId/annotate')
  @RequirePermission(PERMISSIONS.BUDGET_LINE_ANNOTATE)
  annotate(
    @Param('budgetId') budgetId: string,
    @Param('versionId') versionId: string,
    @Param('lineId') lineId: string,
    @Body() dto: AnnotateBudgetLineDto,
  ) {
    return this.linesService.annotate(budgetId, versionId, lineId, dto);
  }

  @Get('annotation-completeness')
  @RequirePermission(PERMISSIONS.BUDGET_LINE_READ)
  annotationCompleteness(
    @Param('budgetId') budgetId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.linesService.getAnnotationCompleteness(budgetId, versionId);
  }

  @Delete(':lineId')
  @RequirePermission(PERMISSIONS.BUDGET_LINE_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('budgetId') budgetId: string,
    @Param('versionId') versionId: string,
    @Param('lineId') lineId: string,
  ) {
    return this.linesService.remove(budgetId, versionId, lineId);
  }
}
