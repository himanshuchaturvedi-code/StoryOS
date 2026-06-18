import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';

import { GrantEstimatorController } from './grant-estimator.controller';
import { GrantEstimatorService } from './grant-estimator.service';
import { DocumentChecklistController } from './document-checklist.controller';
import { DocumentChecklistService } from './document-checklist.service';
import './program-document-specs';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [GrantEstimatorController, DocumentChecklistController],
  providers: [GrantEstimatorService, DocumentChecklistService],
  exports: [GrantEstimatorService, DocumentChecklistService],
})
export class GrantsModule {}
