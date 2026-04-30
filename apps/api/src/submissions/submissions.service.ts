import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { SubmissionStatus, EvaluationSource } from '@storyos/types';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';

const VALID_TRANSITIONS: Record<SubmissionStatus, SubmissionStatus[]> = {
  [SubmissionStatus.DRAFT]: [SubmissionStatus.IN_REVIEW, SubmissionStatus.WITHDRAWN],
  [SubmissionStatus.IN_REVIEW]: [SubmissionStatus.SUBMITTED, SubmissionStatus.DRAFT, SubmissionStatus.WITHDRAWN],
  [SubmissionStatus.SUBMITTED]: [SubmissionStatus.ACCEPTED, SubmissionStatus.REJECTED, SubmissionStatus.WITHDRAWN],
  [SubmissionStatus.ACCEPTED]: [],
  [SubmissionStatus.REJECTED]: [SubmissionStatus.DRAFT],
  [SubmissionStatus.WITHDRAWN]: [],
};

@Injectable()
export class SubmissionsService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async list(projectProgramId: string) {
    await this.assertProjectProgramExists(projectProgramId);
    return this.prisma.programSubmission.findMany({
      where: this.tenantFilter({ projectProgramId }),
      include: {
        evidence: {
          where: this.softDeleteFilter,
          select: { id: true, requirementId: true, evidenceType: true },
        },
        assessments: {
          where: this.softDeleteFilter,
          select: {
            id: true,
            requirementId: true,
            result: true,
            isOverridden: true,
            overrideResult: true,
            isAutoAssessed: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(projectProgramId: string, submissionId: string) {
    const submission = await this.prisma.programSubmission.findFirst({
      where: this.tenantFilter({ id: submissionId, projectProgramId }),
      include: {
        projectProgram: {
          include: {
            programVersion: {
              include: {
                program: {
                  select: { id: true, code: true, name: true },
                },
                requirements: {
                  orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
                },
              },
            },
          },
        },
        evidence: {
          where: this.softDeleteFilter,
          include: {
            requirement: {
              select: { id: true, code: true, name: true, requirementCategory: true },
            },
            document: {
              select: { id: true, title: true, fileName: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        assessments: {
          where: this.softDeleteFilter,
          include: {
            requirement: {
              select: { id: true, code: true, name: true, requirementCategory: true, isRequired: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }

  async create(projectProgramId: string, dto: CreateSubmissionDto) {
    const pp = await this.assertProjectProgramExists(projectProgramId);

    if (dto.budgetVersionId) {
      await this.assertBudgetVersionLockedAndBelongsToProject(
        dto.budgetVersionId,
        pp.projectId,
      );
    }

    this.validateEvaluationSource(dto.evaluationSource ?? null, dto.budgetVersionId ?? null);

    return this.prisma.programSubmission.create({
      data: this.tenantData({
        projectProgramId,
        evaluationDate: new Date(dto.evaluationDate),
        budgetVersionId: dto.budgetVersionId ?? null,
        evaluationSource: dto.evaluationSource ?? null,
        externalRef: dto.externalRef ?? null,
        notes: dto.notes ?? null,
        createdById: this.tenant.userId,
      }),
    });
  }

  async update(projectProgramId: string, submissionId: string, dto: UpdateSubmissionDto) {
    const submission = await this.assertSubmissionExists(projectProgramId, submissionId);
    const isSubmittedOrLater = this.isSubmittedOrLater(submission.status as SubmissionStatus);

    if (dto.status !== undefined) {
      this.assertValidTransition(submission.status as SubmissionStatus, dto.status);

      if (dto.status === SubmissionStatus.SUBMITTED) {
        submission.submittedAt = new Date();
        submission.submittedById = this.tenant.userId;
      }
    }

    // evaluationDate is immutable once submitted
    if (dto.evaluationDate !== undefined && isSubmittedOrLater) {
      throw new ForbiddenException(
        'evaluationDate cannot be changed after submission',
      );
    }

    // budgetVersionId is immutable once submitted
    if (dto.budgetVersionId !== undefined && isSubmittedOrLater) {
      throw new ForbiddenException(
        'budgetVersionId cannot be changed after submission',
      );
    }

    if (dto.budgetVersionId !== undefined && dto.budgetVersionId !== null) {
      const pp = await this.prisma.projectProgram.findUnique({
        where: { id: submission.projectProgramId },
        select: { projectId: true },
      });
      if (pp) {
        await this.assertBudgetVersionLockedAndBelongsToProject(
          dto.budgetVersionId,
          pp.projectId,
        );
      }
    }

    if (dto.evaluationSource !== undefined && isSubmittedOrLater) {
      throw new ForbiddenException(
        'evaluationSource cannot be changed after submission',
      );
    }

    const effectiveBudgetVersionId = dto.budgetVersionId !== undefined
      ? dto.budgetVersionId
      : submission.budgetVersionId;
    const effectiveEvaluationSource = dto.evaluationSource !== undefined
      ? dto.evaluationSource
      : (submission as Record<string, unknown>).evaluationSource as string | null;
    this.validateEvaluationSource(
      effectiveEvaluationSource ?? null,
      effectiveBudgetVersionId ?? null,
    );

    const data: Record<string, unknown> = {};
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === SubmissionStatus.SUBMITTED) {
        data.submittedAt = new Date();
        data.submittedById = this.tenant.userId;
      }
    }
    if (dto.evaluationDate !== undefined) data.evaluationDate = new Date(dto.evaluationDate);
    if (dto.budgetVersionId !== undefined) data.budgetVersionId = dto.budgetVersionId;
    if (dto.evaluationSource !== undefined) data.evaluationSource = dto.evaluationSource;
    if (dto.externalRef !== undefined) data.externalRef = dto.externalRef;
    if (dto.responseDate !== undefined) {
      data.responseDate = dto.responseDate ? new Date(dto.responseDate) : null;
    }
    if (dto.notes !== undefined) data.notes = dto.notes;

    return this.prisma.programSubmission.update({
      where: { id: submissionId },
      data,
    });
  }

  async remove(projectProgramId: string, submissionId: string) {
    const submission = await this.assertSubmissionExists(projectProgramId, submissionId);

    if (
      submission.status === SubmissionStatus.SUBMITTED ||
      submission.status === SubmissionStatus.ACCEPTED
    ) {
      throw new ForbiddenException(
        `Cannot delete a submission with status ${submission.status}`,
      );
    }

    await this.prisma.programSubmission.delete({ where: { id: submissionId } });
  }

  private assertValidTransition(from: SubmissionStatus, to: SubmissionStatus) {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      throw new BadRequestException(
        `Cannot transition from ${from} to ${to}`,
      );
    }
  }

  private async assertBudgetVersionLockedAndBelongsToProject(
    budgetVersionId: string,
    projectId: string,
  ) {
    const version = await this.prisma.budgetVersion.findFirst({
      where: this.tenantFilter({ id: budgetVersionId }),
      include: { budget: { select: { projectId: true } } },
    });
    if (!version) throw new NotFoundException('Budget version not found');
    if (version.status !== 'LOCKED') {
      throw new BadRequestException(
        'Budget version must be LOCKED before linking to a submission',
      );
    }
    if (version.budget.projectId !== projectId) {
      throw new BadRequestException(
        'Budget version must belong to the same project as the submission',
      );
    }
  }

  private isSubmittedOrLater(status: SubmissionStatus): boolean {
    return [
      SubmissionStatus.SUBMITTED,
      SubmissionStatus.ACCEPTED,
      SubmissionStatus.REJECTED,
      SubmissionStatus.WITHDRAWN,
    ].includes(status);
  }

  private validateEvaluationSource(
    evaluationSource: string | null,
    budgetVersionId: string | null,
  ) {
    if (evaluationSource === EvaluationSource.BUDGET && !budgetVersionId) {
      throw new BadRequestException(
        'BUDGET evaluation requires a budgetVersionId',
      );
    }
    if (evaluationSource === EvaluationSource.BLENDED && !budgetVersionId) {
      throw new BadRequestException(
        'BLENDED evaluation requires a budgetVersionId',
      );
    }
  }

  private async assertProjectProgramExists(projectProgramId: string) {
    const pp = await this.prisma.projectProgram.findFirst({
      where: this.tenantFilter({ id: projectProgramId }),
      select: { id: true, projectId: true },
    });
    if (!pp) throw new NotFoundException('Project program enrollment not found');
    return pp;
  }

  async assertSubmissionExists(projectProgramId: string, submissionId: string) {
    const submission = await this.prisma.programSubmission.findFirst({
      where: this.tenantFilter({ id: submissionId, projectProgramId }),
    });
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
  }
}
