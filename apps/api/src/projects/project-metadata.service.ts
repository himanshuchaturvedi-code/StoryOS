import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { UpsertProjectMetadataDto } from './dto/upsert-metadata.dto';

@Injectable()
export class ProjectMetadataService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async get(projectId: string) {
    await this.assertProjectExists(projectId);

    const metadata = await this.prisma.projectMetadata.findFirst({
      where: this.tenantFilter({ projectId }),
    });

    return metadata ?? null;
  }

  async upsert(projectId: string, dto: UpsertProjectMetadataDto) {
    await this.assertProjectExists(projectId);

    return this.prisma.projectMetadata.upsert({
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
