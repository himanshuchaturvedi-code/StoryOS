import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { FinancePlansService } from './finance-plans.service';
import { FinanceSourcesService } from './finance-sources.service';
import { FinancePlansController } from './finance-plans.controller';
import { FinanceSourcesController } from './finance-sources.controller';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [FinancePlansController, FinanceSourcesController],
  providers: [FinancePlansService, FinanceSourcesService],
})
export class FinancePlansModule {}
