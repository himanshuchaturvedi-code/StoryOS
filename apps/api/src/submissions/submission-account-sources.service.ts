import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { EvaluationSource, SubmissionStatus } from '@storyos/types';
import type { SetAccountSourcesDto } from './dto/set-account-sources.dto';

@Injectable()
export class SubmissionAccountSourcesService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async list(projectProgramId: string, submissionId: string) {
    await this.assertSubmission(projectProgramId, submissionId);
    return this.prisma.submissionAccountSource.findMany({
      where: { submissionId, organizationId: this.organizationId },
      include: { budgetAccount: { select: { id: true, code: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Replaces all account source overrides for a submission in a single transaction.
   * Only allowed on DRAFT / IN_REVIEW submissions with evaluationSource = BLENDED.
   */
  async set(
    projectProgramId: string,
    submissionId: string,
    dto: SetAccountSourcesDto,
  ) {
    const submission = await this.assertSubmission(projectProgramId, submissionId);

    const editableStatuses: string[] = [SubmissionStatus.DRAFT, SubmissionStatus.IN_REVIEW];
    if (!editableStatuses.includes(submission.status)) {
      throw new ForbiddenException(
        `Cannot modify account sources on a ${submission.status} submission`,
      );
    }

    if (submission.evaluationSource !== EvaluationSource.BLENDED) {
      throw new BadRequestException(
        'Account source overrides are only applicable when evaluationSource is BLENDED',
      );
    }

    for (const entry of dto.accounts) {
      if (entry.source === EvaluationSource.BLENDED) {
        throw new BadRequestException(
          `Individual account source cannot be BLENDED (account ${entry.budgetAccountId})`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.submissionAccountSource.deleteMany({
        where: { submissionId, organizationId: this.organizationId },
      });

      if (dto.accounts.length === 0) return [];

      await tx.submissionAccountSource.createMany({
        data: dto.accounts.map((a) => ({
          submissionId,
          organizationId: this.organizationId,
          budgetAccountId: a.budgetAccountId,
          source: a.source,
        })),
      });

      return tx.submissionAccountSource.findMany({
        where: { submissionId, organizationId: this.organizationId },
        include: { budgetAccount: { select: { id: true, code: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      });
    });
  }

  private async assertSubmission(projectProgramId: string, submissionId: string) {
    const submission = await this.prisma.programSubmission.findFirst({
      where: this.tenantFilter({ id: submissionId, projectProgramId }),
    });
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }
}
