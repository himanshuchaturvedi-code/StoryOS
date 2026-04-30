import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../tenant/tenant.context';
import type { OrgRole } from '@storyos/types';

/**
 * Validates the X-Organization-Id header and initializes TenantContext.
 *
 * Applied per-route (not global) on endpoints that require org context.
 * Must run AFTER JwtAuthGuard so request.user is available.
 *
 * Steps:
 * 1. Read X-Organization-Id from request header
 * 2. Verify the authenticated user is an active member of that organization
 * 3. Initialize TenantContext with { organizationId, userId, orgRole }
 *
 * Rejects with 400 if header is missing, 403 if user is not a member.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.id;
    if (!userId) return false;

    const orgId = request.headers['x-organization-id'] as string | undefined;
    if (!orgId) {
      throw new BadRequestException(
        'X-Organization-Id header is required for this endpoint',
      );
    }

    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: orgId,
        userId,
        deletedAt: null,
      },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    this.tenantContext.initialize(orgId, userId, membership.role as OrgRole);
    return true;
  }
}
