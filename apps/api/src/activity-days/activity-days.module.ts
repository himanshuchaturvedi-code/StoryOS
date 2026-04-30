import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { ActivityDaysService } from './activity-days.service';
import { ParticipantResidencyService } from './participant-residency.service';
import { ActivityDaysController } from './activity-days.controller';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [ActivityDaysController],
  providers: [ActivityDaysService, ParticipantResidencyService],
})
export class ActivityDaysModule {}
