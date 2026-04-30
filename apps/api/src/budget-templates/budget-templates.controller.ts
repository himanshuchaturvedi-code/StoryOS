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
import { BudgetTemplatesService } from './budget-templates.service';
import { CreateBudgetTemplateDto } from './dto/create-budget-template.dto';
import { UpdateBudgetTemplateDto } from './dto/update-budget-template.dto';
import { CreateTemplateAccountDto } from './dto/create-template-account.dto';
import { UpdateTemplateAccountDto } from './dto/update-template-account.dto';

@UseGuards(TenantGuard, PermissionGuard)
@Controller('budget-templates')
export class BudgetTemplatesController {
  constructor(private readonly budgetTemplatesService: BudgetTemplatesService) {}

  // ── Templates ─────────────────────────────────────────────────────────────

  @Get()
  @RequirePermission(PERMISSIONS.BUDGET_TEMPLATE_READ)
  list() {
    return this.budgetTemplatesService.list();
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.BUDGET_TEMPLATE_READ)
  findOne(@Param('id') id: string) {
    return this.budgetTemplatesService.findById(id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.BUDGET_TEMPLATE_CREATE)
  create(@Body() dto: CreateBudgetTemplateDto) {
    return this.budgetTemplatesService.create(dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.BUDGET_TEMPLATE_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateBudgetTemplateDto) {
    return this.budgetTemplatesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.BUDGET_TEMPLATE_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.budgetTemplatesService.remove(id);
  }

  // ── Template accounts ─────────────────────────────────────────────────────

  @Post(':id/accounts')
  @RequirePermission(PERMISSIONS.BUDGET_TEMPLATE_UPDATE)
  addAccount(@Param('id') id: string, @Body() dto: CreateTemplateAccountDto) {
    return this.budgetTemplatesService.addAccount(id, dto);
  }

  @Patch(':id/accounts/:accountId')
  @RequirePermission(PERMISSIONS.BUDGET_TEMPLATE_UPDATE)
  updateAccount(
    @Param('id') id: string,
    @Param('accountId') accountId: string,
    @Body() dto: UpdateTemplateAccountDto,
  ) {
    return this.budgetTemplatesService.updateAccount(id, accountId, dto);
  }

  @Delete(':id/accounts/:accountId')
  @RequirePermission(PERMISSIONS.BUDGET_TEMPLATE_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAccount(@Param('id') id: string, @Param('accountId') accountId: string) {
    return this.budgetTemplatesService.removeAccount(id, accountId);
  }
}
