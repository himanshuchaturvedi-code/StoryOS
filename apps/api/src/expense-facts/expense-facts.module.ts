import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { ExpenseFactsService } from './expense-facts.service';
import { ExpenseFactsController } from './expense-facts.controller';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [ExpenseFactsController],
  providers: [ExpenseFactsService],
  exports: [ExpenseFactsService],
})
export class ExpenseFactsModule {}
