import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantModule } from '../tenant/tenant.module';
import { SubmissionsService } from './submissions.service';
import { SubmissionEvidenceService } from './submission-evidence.service';
import { SubmissionAccountSourcesService } from './submission-account-sources.service';
import { RequirementAssessmentsService } from './requirement-assessments.service';
import { SubmissionsController } from './submissions.controller';

@Module({
  imports: [PrismaModule, TenantModule],
  controllers: [SubmissionsController],
  providers: [
    SubmissionsService,
    SubmissionEvidenceService,
    SubmissionAccountSourcesService,
    RequirementAssessmentsService,
  ],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
