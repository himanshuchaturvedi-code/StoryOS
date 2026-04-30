import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { AssessmentResult, SubmissionStatus } from '@storyos/types';
import { SubmissionsService } from './submissions.service';
import { OverrideAssessmentDto } from './dto/override-assessment.dto';

@Injectable()
export class RequirementAssessmentsService extends TenantAwareService {
  constructor(
    prisma: PrismaService,
    tenant: TenantContext,
    private readonly submissionsService: SubmissionsService,
  ) {
    super(prisma, tenant);
  }

  async list(projectProgramId: string, submissionId: string) {
    await this.submissionsService.assertSubmissionExists(projectProgramId, submissionId);
    return this.prisma.requirementAssessment.findMany({
      where: this.tenantFilter({ submissionId }),
      include: {
        requirement: {
          select: {
            id: true,
            code: true,
            name: true,
            requirementCategory: true,
            isRequired: true,
            isBonusEligible: true,
            primaryFactSource: true,
          },
        },
      },
      orderBy: { requirement: { sortOrder: 'asc' } },
    });
  }

  async findById(
    projectProgramId: string,
    submissionId: string,
    assessmentId: string,
  ) {
    await this.submissionsService.assertSubmissionExists(projectProgramId, submissionId);
    const assessment = await this.prisma.requirementAssessment.findFirst({
      where: this.tenantFilter({ id: assessmentId, submissionId }),
      include: {
        requirement: true,
      },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    return assessment;
  }

  /**
   * Initializes NOT_EVALUATED assessment rows for all requirements of a submission.
   * Idempotent: skips requirements that already have an assessment.
   * Cannot run after submission is SUBMITTED or later (audit integrity).
   */
  async initializeForSubmission(projectProgramId: string, submissionId: string) {
    const submission = await this.submissionsService.assertSubmissionExists(
      projectProgramId,
      submissionId,
    );

    const submittedOrLater = [
      SubmissionStatus.SUBMITTED,
      SubmissionStatus.ACCEPTED,
      SubmissionStatus.REJECTED,
      SubmissionStatus.WITHDRAWN,
    ].includes(submission.status as SubmissionStatus);
    if (submittedOrLater) {
      throw new BadRequestException(
        'Cannot initialize assessments after submission has been submitted',
      );
    }

    const pp = await this.prisma.projectProgram.findUnique({
      where: { id: submission.projectProgramId },
      select: { programVersionId: true },
    });
    if (!pp) throw new NotFoundException('Project program not found');

    const requirements = await this.prisma.programRequirement.findMany({
      where: { programVersionId: pp.programVersionId },
      select: { id: true },
    });

    const existing = await this.prisma.requirementAssessment.findMany({
      where: this.tenantFilter({ submissionId }),
      select: { requirementId: true },
    });
    const existingIds = new Set(existing.map((a) => a.requirementId));

    const toCreate = requirements.filter((r) => !existingIds.has(r.id));

    if (toCreate.length > 0) {
      await this.prisma.requirementAssessment.createMany({
        data: toCreate.map((r) => ({
          submissionId,
          organizationId: this.organizationId,
          requirementId: r.id,
          result: AssessmentResult.NOT_EVALUATED,
        })),
        skipDuplicates: true,
      });
    }

    return this.list(projectProgramId, submissionId);
  }

  /**
   * Apply a manual override to an assessment.
   * Preserves the original computed result; sets isOverridden + overrideResult.
   */
  async override(
    projectProgramId: string,
    submissionId: string,
    assessmentId: string,
    dto: OverrideAssessmentDto,
  ) {
    await this.submissionsService.assertSubmissionExists(projectProgramId, submissionId);
    const assessment = await this.prisma.requirementAssessment.findFirst({
      where: this.tenantFilter({ id: assessmentId, submissionId }),
      select: { id: true, result: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');

    if (dto.overrideResult === AssessmentResult.NOT_EVALUATED) {
      throw new BadRequestException('Cannot override to NOT_EVALUATED');
    }

    return this.prisma.requirementAssessment.update({
      where: { id: assessmentId },
      data: {
        isOverridden: true,
        overrideResult: dto.overrideResult,
        overrideReason: dto.overrideReason,
        overriddenById: this.tenant.userId,
        overriddenAt: new Date(),
      },
      include: {
        requirement: {
          select: { id: true, code: true, name: true, requirementCategory: true },
        },
      },
    });
  }

  /**
   * Remove an override, restoring the original computed result.
   */
  async clearOverride(
    projectProgramId: string,
    submissionId: string,
    assessmentId: string,
  ) {
    await this.submissionsService.assertSubmissionExists(projectProgramId, submissionId);
    const assessment = await this.prisma.requirementAssessment.findFirst({
      where: this.tenantFilter({ id: assessmentId, submissionId }),
      select: { id: true, isOverridden: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (!assessment.isOverridden) {
      throw new BadRequestException('Assessment is not overridden');
    }

    return this.prisma.requirementAssessment.update({
      where: { id: assessmentId },
      data: {
        isOverridden: false,
        overrideResult: null,
        overrideReason: null,
        overriddenById: null,
        overriddenAt: null,
      },
      include: {
        requirement: {
          select: { id: true, code: true, name: true, requirementCategory: true },
        },
      },
    });
  }
}
