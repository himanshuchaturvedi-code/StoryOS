import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async list() {
    return this.prisma.project.findMany({
      where: this.tenantFilter(),
      include: {
        metadata: { where: this.softDeleteFilter },
        format: { where: this.softDeleteFilter },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(dto: CreateProjectDto) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: this.tenantData({
          title: dto.title,
          status: 'DRAFT',
          stage: 'DEVELOPMENT',
          createdById: this.tenant.userId,
        }),
      });

      await tx.projectAccess.create({
        data: this.tenantData({
          projectId: project.id,
          userId: this.tenant.userId,
          role: 'OWNER',
          createdById: this.tenant.userId,
        }),
      });

      await tx.projectStageHistory.create({
        data: {
          projectId: project.id,
          organizationId: this.organizationId,
          stage: 'DEVELOPMENT',
          changedById: this.tenant.userId,
        },
      });

      return project;
    });
  }

  async findById(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      include: {
        metadata: { where: this.softDeleteFilter },
        format: { where: this.softDeleteFilter },
        phases: { where: this.softDeleteFilter },
        milestones: { where: this.softDeleteFilter },
      },
    });

    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(projectId: string, dto: UpdateProjectDto) {
    await this.assertProjectExists(projectId);

    return this.prisma.project.update({
      where: { id: projectId },
      data: { ...dto, status: dto.status as any },
    });
  }

  async softDelete(projectId: string) {
    await this.assertProjectExists(projectId);
    await this.prisma.project.delete({ where: { id: projectId } });
  }

  protected async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }
}
