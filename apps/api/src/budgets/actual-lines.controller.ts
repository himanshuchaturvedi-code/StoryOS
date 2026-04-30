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
import { ActualLinesService } from './actual-lines.service';
import { CreateActualLineDto } from './dto/create-actual-line.dto';
import { UpdateActualLineDto } from './dto/update-actual-line.dto';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('budgets/:budgetId/actuals')
export class ActualLinesController {
  constructor(private readonly actualsService: ActualLinesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ACTUAL_READ)
  list(
    @Param('budgetId') budgetId: string,
    @Query('accountId') accountId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.actualsService.list(budgetId, accountId, from, to);
  }

  @Post()
  @RequirePermission(PERMISSIONS.ACTUAL_CREATE)
  create(@Param('budgetId') budgetId: string, @Body() dto: CreateActualLineDto) {
    return this.actualsService.create(budgetId, dto);
  }

  @Get('reconciliation')
  @RequirePermission(PERMISSIONS.ACTUAL_READ)
  reconciliation(
    @Param('budgetId') budgetId: string,
    @Query('versionId') versionId: string,
  ) {
    return this.actualsService.reconciliation(budgetId, versionId);
  }

  @Patch(':actualId')
  @RequirePermission(PERMISSIONS.ACTUAL_UPDATE)
  update(
    @Param('budgetId') budgetId: string,
    @Param('actualId') actualId: string,
    @Body() dto: UpdateActualLineDto,
  ) {
    return this.actualsService.update(budgetId, actualId, dto);
  }

  @Delete(':actualId')
  @RequirePermission(PERMISSIONS.ACTUAL_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('budgetId') budgetId: string, @Param('actualId') actualId: string) {
    return this.actualsService.remove(budgetId, actualId);
  }
}
