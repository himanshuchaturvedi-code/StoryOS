import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContext } from '../tenant/tenant.context';
import { TenantAwareService } from '../tenant/tenant-aware.service';
import { OrgRole } from '@storyos/types';

@Injectable()
export class MembersService extends TenantAwareService {
  constructor(prisma: PrismaService, tenant: TenantContext) {
    super(prisma, tenant);
  }

  async list() {
    return this.prisma.organizationMember.findMany({
      where: this.tenantFilter(),
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

  async updateRole(memberId: string, newRole: OrgRole) {
    const member = await this.findMemberOrThrow(memberId);

    if (member.userId === this.tenant.userId && member.role === 'OWNER') {
      const ownerCount = await this.prisma.organizationMember.count({
        where: this.tenantFilter({ role: 'OWNER' as any }),
      });

      if (ownerCount <= 1) {
        throw new BadRequestException(
          'Cannot change role — you are the only owner. Transfer ownership first.',
        );
      }
    }

    return this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { role: newRole as any },
    });
  }

  async remove(memberId: string) {
    const member = await this.findMemberOrThrow(memberId);

    if (member.userId === this.tenant.userId) {
      throw new ForbiddenException('Cannot remove yourself. Leave the organization instead.');
    }

    if (member.role === 'OWNER') {
      throw new ForbiddenException('Cannot remove an owner. Change their role first.');
    }

    await this.prisma.organizationMember.delete({ where: { id: memberId } });
  }

  private async findMemberOrThrow(memberId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: this.tenantFilter({ id: memberId }),
    });

    if (!member) throw new NotFoundException('Member not found');
    return member;
  }
}
