import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { ProjectProgramStatus } from '@storyos/types';
import { CreateProjectProgramDto } from './dto/create-project-program.dto';
import { UpdateProjectProgramDto } from './dto/update-project-program.dto';

@Injectable()
export class ProjectProgramsService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async list(projectId: string) {
    await this.assertProjectExists(projectId);
    return this.prisma.projectProgram.findMany({
      where: this.tenantFilter({ projectId }),
      include: {
        programVersion: {
          include: {
            program: {
              select: { id: true, code: true, name: true, scope: true, country: true },
            },
          },
        },
        submissions: {
          where: this.softDeleteFilter,
          select: {
            id: true,
            status: true,
            evaluationDate: true,
            submittedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(projectId: string, projectProgramId: string) {
    const pp = await this.prisma.projectProgram.findFirst({
      where: this.tenantFilter({ id: projectProgramId, projectId }),
      include: {
        programVersion: {
          include: {
            program: true,
            requirements: {
              orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
            },
          },
        },
        submissions: {
          where: this.softDeleteFilter,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!pp) throw new NotFoundException('Project program enrollment not found');
    return pp;
  }

  async create(projectId: string, dto: CreateProjectProgramDto) {
    await this.assertProjectExists(projectId);
    await this.assertProgramVersionExists(dto.programVersionId);

    const existing = await this.prisma.projectProgram.findFirst({
      where: this.tenantFilter({
        projectId,
        programVersionId: dto.programVersionId,
      }),
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'This project is already enrolled in this program version',
      );
    }

    return this.prisma.projectProgram.create({
      data: this.tenantData({
        projectId,
        programVersionId: dto.programVersionId,
        status: dto.status ?? ProjectProgramStatus.ACTIVE,
        targetSubmissionDate: dto.targetSubmissionDate
          ? new Date(dto.targetSubmissionDate)
          : null,
        notes: dto.notes ?? null,
        createdById: this.tenant.userId,
      }),
      include: {
        programVersion: {
          include: {
            program: {
              select: { id: true, code: true, name: true, scope: true, country: true },
            },
          },
        },
      },
    });
  }

  async update(projectId: string, projectProgramId: string, dto: UpdateProjectProgramDto) {
    await this.assertProjectProgramExists(projectId, projectProgramId);

    const data: Record<string, unknown> = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.targetSubmissionDate !== undefined) {
      data.targetSubmissionDate = dto.targetSubmissionDate
        ? new Date(dto.targetSubmissionDate)
        : null;
    }
    if (dto.notes !== undefined) data.notes = dto.notes;

    return this.prisma.projectProgram.update({
      where: { id: projectProgramId },
      data,
      include: {
        programVersion: {
          include: {
            program: {
              select: { id: true, code: true, name: true, scope: true, country: true },
            },
          },
        },
      },
    });
  }

  async remove(projectId: string, projectProgramId: string) {
    await this.assertProjectProgramExists(projectId, projectProgramId);
    await this.prisma.projectProgram.delete({ where: { id: projectProgramId } });
  }

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }

  private async assertProgramVersionExists(programVersionId: string) {
    const version = await this.prisma.programVersion.findUnique({
      where: { id: programVersionId },
      select: { id: true },
    });
    if (!version) throw new NotFoundException('Program version not found');
  }

  private async assertProjectProgramExists(projectId: string, projectProgramId: string) {
    const pp = await this.prisma.projectProgram.findFirst({
      where: this.tenantFilter({ id: projectProgramId, projectId }),
      select: { id: true },
    });
    if (!pp) throw new NotFoundException('Project program enrollment not found');
  }
}
