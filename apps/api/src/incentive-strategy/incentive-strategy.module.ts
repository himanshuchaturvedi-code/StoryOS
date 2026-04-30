import { Module } from '@nestjs/common';

import { CalculatorsModule } from '../calculators/calculators.module';
import { GrantsModule } from '../grants/grants.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { IncentiveStrategyController } from './incentive-strategy.controller';
import { IncentiveStrategyService } from './incentive-strategy.service';

@Module({
  imports: [PrismaModule, TenantModule, CalculatorsModule, GrantsModule],
  controllers: [IncentiveStrategyController],
  providers: [IncentiveStrategyService],
})
export class IncentiveStrategyModule {}
