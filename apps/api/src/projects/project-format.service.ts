import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { UpsertProjectFormatDto } from './dto/upsert-format.dto';

@Injectable()
export class ProjectFormatService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async get(projectId: string) {
    await this.assertProjectExists(projectId);

    const format = await this.prisma.projectFormat.findFirst({
      where: this.tenantFilter({ projectId }),
    });

    return format ?? null;
  }

  async upsert(projectId: string, dto: UpsertProjectFormatDto) {
    await this.assertProjectExists(projectId);

    return this.prisma.projectFormat.upsert({
      where: { projectId },
      create: this.tenantData({
        projectId,
        createdById: this.tenant.userId,
        ...dto,
      }),
      update: {
        ...dto,
        createdById: this.tenant.userId,
      },
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
