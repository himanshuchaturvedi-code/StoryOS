import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { Prisma } from '@storyos/database';
import { SubmissionStatus } from '@storyos/types';
import { SubmissionsService } from './submissions.service';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { UpdateEvidenceDto } from './dto/update-evidence.dto';

@Injectable()
export class SubmissionEvidenceService extends TenantAwareService {
  constructor(
    prisma: PrismaService,
    tenant: TenantContext,
    private readonly submissionsService: SubmissionsService,
  ) {
    super(prisma, tenant);
  }

  async list(projectProgramId: string, submissionId: string) {
    await this.submissionsService.assertSubmissionExists(projectProgramId, submissionId);
    return this.prisma.submissionEvidence.findMany({
      where: this.tenantFilter({ submissionId }),
      include: {
        requirement: {
          select: { id: true, code: true, name: true, requirementCategory: true },
        },
        document: {
          select: { id: true, title: true, fileName: true },
        },
      },
      orderBy: [{ requirement: { sortOrder: 'asc' } }, { createdAt: 'asc' }],
    });
  }

  async findById(projectProgramId: string, submissionId: string, evidenceId: string) {
    await this.submissionsService.assertSubmissionExists(projectProgramId, submissionId);
    const evidence = await this.prisma.submissionEvidence.findFirst({
      where: this.tenantFilter({ id: evidenceId, submissionId }),
      include: {
        requirement: true,
        document: {
          select: { id: true, title: true, fileName: true, fileType: true },
        },
      },
    });
    if (!evidence) throw new NotFoundException('Evidence not found');
    return evidence;
  }

  async create(projectProgramId: string, submissionId: string, dto: CreateEvidenceDto) {
    const submission = await this.submissionsService.assertSubmissionExists(
      projectProgramId,
      submissionId,
    );
    this.assertSubmissionEditable(submission.status as SubmissionStatus);
    await this.assertRequirementBelongsToSubmission(submissionId, dto.requirementId);

    if (dto.documentId) {
      await this.assertDocumentExists(dto.documentId);
    }

    return this.prisma.submissionEvidence.create({
      data: this.tenantData({
        submissionId,
        requirementId: dto.requirementId,
        evidenceType: dto.evidenceType,
        factSource: dto.factSource ?? null,
        factQuery: dto.factQuery
          ? (dto.factQuery as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        documentId: dto.documentId ?? null,
        manualPayload: dto.manualPayload
          ? (dto.manualPayload as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        notes: dto.notes ?? null,
      }),
      include: {
        requirement: {
          select: { id: true, code: true, name: true, requirementCategory: true },
        },
      },
    });
  }

  async update(
    projectProgramId: string,
    submissionId: string,
    evidenceId: string,
    dto: UpdateEvidenceDto,
  ) {
    const submission = await this.submissionsService.assertSubmissionExists(
      projectProgramId,
      submissionId,
    );
    this.assertSubmissionEditable(submission.status as SubmissionStatus);
    await this.assertEvidenceExists(submissionId, evidenceId);

    if (dto.documentId) {
      await this.assertDocumentExists(dto.documentId);
    }

    const data: Record<string, unknown> = {};
    if (dto.evidenceType !== undefined) data.evidenceType = dto.evidenceType;
    if (dto.factSource !== undefined) data.factSource = dto.factSource;
    if (dto.factQuery !== undefined) {
      data.factQuery = dto.factQuery
        ? (dto.factQuery as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }
    if (dto.documentId !== undefined) data.documentId = dto.documentId;
    if (dto.manualPayload !== undefined) {
      data.manualPayload = dto.manualPayload
        ? (dto.manualPayload as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }
    if (dto.notes !== undefined) data.notes = dto.notes;

    return this.prisma.submissionEvidence.update({
      where: { id: evidenceId },
      data,
      include: {
        requirement: {
          select: { id: true, code: true, name: true, requirementCategory: true },
        },
      },
    });
  }

  async remove(projectProgramId: string, submissionId: string, evidenceId: string) {
    const submission = await this.submissionsService.assertSubmissionExists(
      projectProgramId,
      submissionId,
    );
    this.assertSubmissionEditable(submission.status as SubmissionStatus);
    await this.assertEvidenceExists(submissionId, evidenceId);
    await this.prisma.submissionEvidence.delete({ where: { id: evidenceId } });
  }

  private assertSubmissionEditable(status: SubmissionStatus) {
    if (
      status === SubmissionStatus.SUBMITTED ||
      status === SubmissionStatus.ACCEPTED ||
      status === SubmissionStatus.WITHDRAWN
    ) {
      throw new ForbiddenException(
        `Cannot modify evidence on a submission with status ${status}`,
      );
    }
  }

  private async assertRequirementBelongsToSubmission(
    submissionId: string,
    requirementId: string,
  ) {
    const submission = await this.prisma.programSubmission.findUnique({
      where: { id: submissionId },
      select: {
        projectProgram: {
          select: { programVersionId: true },
        },
      },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    const requirement = await this.prisma.programRequirement.findFirst({
      where: {
        id: requirementId,
        programVersionId: submission.projectProgram.programVersionId,
      },
      select: { id: true },
    });
    if (!requirement) {
      throw new BadRequestException(
        'Requirement does not belong to the program version for this submission',
      );
    }
  }

  private async assertDocumentExists(documentId: string) {
    const doc = await this.prisma.document.findFirst({
      where: this.tenantFilter({ id: documentId }),
      select: { id: true },
    });
    if (!doc) throw new NotFoundException('Document not found');
  }

  private async assertEvidenceExists(submissionId: string, evidenceId: string) {
    const evidence = await this.prisma.submissionEvidence.findFirst({
      where: this.tenantFilter({ id: evidenceId, submissionId }),
      select: { id: true },
    });
    if (!evidence) throw new NotFoundException('Evidence not found');
  }
}
