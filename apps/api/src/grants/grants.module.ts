import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';

import { GrantEstimatorController } from './grant-estimator.controller';
import { GrantEstimatorService } from './grant-estimator.service';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [GrantEstimatorController],
  providers: [GrantEstimatorService],
  exports: [GrantEstimatorService],
})
export class GrantsModule {}
