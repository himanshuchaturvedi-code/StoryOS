import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { BudgetTemplatesController } from './budget-templates.controller';
import { BudgetTemplatesService } from './budget-templates.service';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [BudgetTemplatesController],
  providers: [BudgetTemplatesService],
  // Exported so BudgetsModule can call cloneAccountsToBudget during budget creation
  exports: [BudgetTemplatesService],
})
export class BudgetTemplatesModule {}
