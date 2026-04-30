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
import { FinanceSourcesService } from './finance-sources.service';
import { CreateFinanceSourceDto } from './dto/create-finance-source.dto';
import { UpdateFinanceSourceDto } from './dto/update-finance-source.dto';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('finance-plans/:planId/sources')
export class FinanceSourcesController {
  constructor(private readonly sourcesService: FinanceSourcesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.FINANCE_PLAN_READ)
  list(@Param('planId') planId: string) {
    return this.sourcesService.list(planId);
  }

  @Post()
  @RequirePermission(PERMISSIONS.FINANCE_PLAN_UPDATE)
  create(@Param('planId') planId: string, @Body() dto: CreateFinanceSourceDto) {
    return this.sourcesService.create(planId, dto);
  }

  @Patch(':sourceId')
  @RequirePermission(PERMISSIONS.FINANCE_PLAN_UPDATE)
  update(
    @Param('planId') planId: string,
    @Param('sourceId') sourceId: string,
    @Body() dto: UpdateFinanceSourceDto,
  ) {
    return this.sourcesService.update(planId, sourceId, dto);
  }

  @Delete(':sourceId')
  @RequirePermission(PERMISSIONS.FINANCE_PLAN_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('planId') planId: string, @Param('sourceId') sourceId: string) {
    return this.sourcesService.remove(planId, sourceId);
  }
}
