import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { ActivityPlansController } from './activity-plans.controller';
import { ActivityPlansService } from './activity-plans.service';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [ActivityPlansController],
  providers: [ActivityPlansService],
})
export class ActivityPlansModule {}
