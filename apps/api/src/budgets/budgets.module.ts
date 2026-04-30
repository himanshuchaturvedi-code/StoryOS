import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { BudgetTemplatesModule } from '../budget-templates/budget-templates.module';

import { BudgetsService } from './budgets.service';
import { BudgetAccountsService } from './budget-accounts.service';
import { BudgetVersionsService } from './budget-versions.service';
import { BudgetLinesService } from './budget-lines.service';
import { ActualLinesService } from './actual-lines.service';

import { BudgetsController } from './budgets.controller';
import { BudgetAccountsController } from './budget-accounts.controller';
import { BudgetVersionsController } from './budget-versions.controller';
import { BudgetLinesController } from './budget-lines.controller';
import { ActualLinesController } from './actual-lines.controller';

@Module({
  imports: [PrismaModule, TenantModule, BudgetTemplatesModule],
  controllers: [
    BudgetsController,
    BudgetAccountsController,
    BudgetVersionsController,
    BudgetLinesController,
    ActualLinesController,
  ],
  providers: [
    BudgetsService,
    BudgetAccountsService,
    BudgetVersionsService,
    BudgetLinesService,
    ActualLinesService,
  ],
  exports: [BudgetsService],
})
export class BudgetsModule {}
