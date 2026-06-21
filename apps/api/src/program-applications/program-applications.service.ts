import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { ProgramApplicationStatus } from '@storyos/types';
import { CreateProgramApplicationDto } from './dto/create-program-application.dto';
import { UpdateProgramApplicationDto } from './dto/update-program-application.dto';

const applicationInclude = {
  projectProgram: {
    include: {
      programVersion: {
        include: {
          program: {
            select: { id: true, code: true, name: true, scope: true, country: true },
          },
        },
      },
    },
  },
  createdBy: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} as const;

@Injectable()
export class ProgramApplicationsService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  /** ProgramApplication has no soft-delete column; filter by organization only. */
  private applicationFilter<T extends Record<string, unknown>>(extra: T = {} as T) {
    return { organizationId: this.organizationId, ...extra };
  }

  async findAllByProject(projectId: string) {
    return this.prisma.programApplication.findMany({
      where: this.applicationFilter({
        projectProgram: { projectId },
      }),
      include: applicationInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(projectId: string, applicationId: string) {
    const application = await this.prisma.programApplication.findFirst({
      where: this.applicationFilter({
        id: applicationId,
        projectProgram: { projectId },
      }),
      include: applicationInclude,
    });

    if (!application) {
      throw new NotFoundException('Program application not found');
    }

    return application;
  }

  async initiateApplication(projectId: string, programVersionId: string) {
    let projectProgram = await this.prisma.projectProgram.findFirst({
      where: this.tenantFilter({ projectId, programVersionId }),
    });

    if (!projectProgram) {
      projectProgram = await this.prisma.projectProgram.create({
        data: this.tenantData({
          projectId,
          programVersionId,
          createdById: this.tenant.userId,
        }),
      });
    }

    const existingApplication = await this.prisma.programApplication.findFirst({
      where: this.applicationFilter({ projectProgramId: projectProgram.id }),
      include: applicationInclude,
    });

    if (existingApplication) {
      return existingApplication;
    }

    return this.prisma.programApplication.create({
      data: this.tenantData({
        projectProgramId: projectProgram.id,
        status: ProgramApplicationStatus.PREPARING,
        createdById: this.tenant.userId,
      }),
      include: applicationInclude,
    });
  }

  async findByProjectProgram(projectId: string, projectProgramId: string) {
    await this.assertProjectProgramExists(projectId, projectProgramId);

    const application = await this.prisma.programApplication.findFirst({
      where: this.applicationFilter({
        projectProgramId,
        projectProgram: { projectId },
      }),
      include: applicationInclude,
    });

    if (!application) {
      throw new NotFoundException('Program application not found');
    }

    return application;
  }

  async create(
    projectId: string,
    projectProgramId: string,
    dto: CreateProgramApplicationDto,
  ) {
    await this.assertProjectProgramExists(projectId, projectProgramId);

    const existing = await this.prisma.programApplication.findFirst({
      where: this.applicationFilter({ projectProgramId }),
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('An application already exists for this program enrollment');
    }

    return this.prisma.programApplication.create({
      data: this.tenantData({
        projectProgramId,
        status: ProgramApplicationStatus.PREPARING,
        targetFilingDate: dto.targetFilingDate ? new Date(dto.targetFilingDate) : null,
        notes: dto.notes ?? null,
        createdById: this.tenant.userId,
      }),
      include: applicationInclude,
    });
  }

  async update(
    projectId: string,
    projectProgramId: string,
    dto: UpdateProgramApplicationDto,
  ) {
    await this.assertProjectProgramExists(projectId, projectProgramId);

    const existing = await this.prisma.programApplication.findFirst({
      where: this.applicationFilter({
        projectProgramId,
        projectProgram: { projectId },
      }),
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Program application not found');
    }

    const data: Record<string, unknown> = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.targetFilingDate !== undefined) {
      data.targetFilingDate = dto.targetFilingDate ? new Date(dto.targetFilingDate) : null;
    }
    if (dto.filedAt !== undefined) {
      data.filedAt = dto.filedAt ? new Date(dto.filedAt) : null;
    }
    if (dto.decidedAt !== undefined) {
      data.decidedAt = dto.decidedAt ? new Date(dto.decidedAt) : null;
    }
    if (dto.externalRef !== undefined) data.externalRef = dto.externalRef;
    if (dto.notes !== undefined) data.notes = dto.notes;

    return this.prisma.programApplication.update({
      where: { id: existing.id },
      data,
      include: applicationInclude,
    });
  }

  private async assertProjectProgramExists(projectId: string, projectProgramId: string) {
    const projectProgram = await this.prisma.projectProgram.findFirst({
      where: this.tenantFilter({ id: projectProgramId, projectId }),
      select: { id: true },
    });
    if (!projectProgram) {
      throw new NotFoundException('Project program enrollment not found');
    }
  }
}
