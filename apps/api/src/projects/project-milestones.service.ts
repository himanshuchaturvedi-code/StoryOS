import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';

@Injectable()
export class ProjectMilestonesService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async list(projectId: string) {
    await this.assertProjectExists(projectId);

    return this.prisma.projectMilestone.findMany({
      where: this.tenantFilter({ projectId }),
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(projectId: string, dto: CreateMilestoneDto) {
    await this.assertProjectExists(projectId);

    return this.prisma.projectMilestone.create({
      data: this.tenantData({
        projectId,
        createdById: this.tenant.userId,
        name: dto.name,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        actualDate: dto.actualDate ? new Date(dto.actualDate) : undefined,
        notes: dto.notes,
      }),
    });
  }

  async update(projectId: string, milestoneId: string, dto: UpdateMilestoneDto) {
    await this.assertProjectExists(projectId);

    const milestone = await this.prisma.projectMilestone.findFirst({
      where: this.tenantFilter({ id: milestoneId, projectId }),
    });

    if (!milestone) throw new NotFoundException('Milestone not found');

    return this.prisma.projectMilestone.update({
      where: { id: milestoneId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
        ...(dto.actualDate !== undefined && { actualDate: new Date(dto.actualDate) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async remove(projectId: string, milestoneId: string) {
    await this.assertProjectExists(projectId);

    const milestone = await this.prisma.projectMilestone.findFirst({
      where: this.tenantFilter({ id: milestoneId, projectId }),
    });

    if (!milestone) throw new NotFoundException('Milestone not found');

    await this.prisma.projectMilestone.delete({ where: { id: milestoneId } });
  }

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }
}
