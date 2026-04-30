import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { UpdateStageDto } from './dto/update-stage.dto';

@Injectable()
export class ProjectStagesService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async getHistory(projectId: string) {
    await this.assertProjectExists(projectId);

    return this.prisma.projectStageHistory.findMany({
      where: { projectId, organizationId: this.organizationId },
      include: {
        changedBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { enteredAt: 'desc' },
    });
  }

  async updateStage(projectId: string, dto: UpdateStageDto) {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true, stage: true },
    });

    if (!project) throw new NotFoundException('Project not found');

    return this.prisma.$transaction(async (tx) => {
      await tx.projectStageHistory.updateMany({
        where: {
          projectId,
          organizationId: this.organizationId,
          exitedAt: null,
        },
        data: { exitedAt: new Date() },
      });

      await tx.projectStageHistory.create({
        data: {
          projectId,
          organizationId: this.organizationId,
          stage: dto.stage as any,
          notes: dto.notes,
          changedById: this.tenant.userId,
        },
      });

      return tx.project.update({
        where: { id: projectId },
        data: { stage: dto.stage as any },
      });
    });
  }

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }
}
