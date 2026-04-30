import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { GrantProjectAccessDto } from './dto/grant-access.dto';

@Injectable()
export class ProjectAccessService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async list(projectId: string) {
    await this.assertProjectExists(projectId);

    return this.prisma.projectAccess.findMany({
      where: this.tenantFilter({ projectId }),
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async grant(projectId: string, dto: GrantProjectAccessDto) {
    await this.assertProjectExists(projectId);

    const existingMember = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: this.organizationId,
        userId: dto.userId,
        deletedAt: null,
      },
    });

    if (!existingMember) {
      throw new BadRequestException(
        'User must be a member of the organization before being granted project access',
      );
    }

    const existing = await this.prisma.projectAccess.findFirst({
      where: this.tenantFilter({ projectId, userId: dto.userId }),
    });

    if (existing) {
      throw new ConflictException('User already has access to this project');
    }

    return this.prisma.projectAccess.create({
      data: this.tenantData({
        projectId,
        userId: dto.userId,
        role: dto.role as any,
        createdById: this.tenant.userId,
      }),
    });
  }

  async updateRole(projectId: string, userId: string, role: string) {
    await this.assertProjectExists(projectId);

    const access = await this.prisma.projectAccess.findFirst({
      where: this.tenantFilter({ projectId, userId }),
    });

    if (!access) throw new NotFoundException('Project access not found');

    return this.prisma.projectAccess.update({
      where: { id: access.id },
      data: { role: role as any },
    });
  }

  async revoke(projectId: string, userId: string) {
    await this.assertProjectExists(projectId);

    const access = await this.prisma.projectAccess.findFirst({
      where: this.tenantFilter({ projectId, userId }),
    });

    if (!access) throw new NotFoundException('Project access not found');

    await this.prisma.projectAccess.delete({ where: { id: access.id } });
  }

  private async assertProjectExists(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: this.tenantFilter({ id: projectId }),
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }
}
