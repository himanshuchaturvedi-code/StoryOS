import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { TenantContext } from '../../tenant/tenant.context';
import { PrismaService } from '../../prisma/prisma.service';
import {
  type Permission,
  type OrgRole,
  type ProjectRole,
  hasPermission,
} from '@storyos/types';

/**
 * Evaluates @RequirePermission() against the user's org and project roles.
 *
 * Must run AFTER TenantGuard so TenantContext.orgRole is available.
 * Guard order on routes: @UseGuards(TenantGuard, PermissionGuard)
 *
 * Resolution:
 * 1. Read the required permission from @RequirePermission metadata
 * 2. If no permission is declared, allow (guard is a no-op)
 * 3. Check if the user's org role grants the permission → allow
 * 4. If a projectId is present in route params, look up ProjectAccess.role
 *    and check if the project role grants the permission → allow
 * 5. Neither grants it → deny
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContext,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.getAllAndOverride<Permission | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermission) return true;

    const orgRole = this.tenantContext.orgRole as OrgRole;
    const userId = this.tenantContext.userId;

    // Check project-level role if a projectId is in the route
    const request = context.switchToHttp().getRequest();
    const projectId: string | undefined = request.params?.projectId;

    let projectRole: ProjectRole | undefined;

    if (projectId) {
      const access = await this.prisma.projectAccess.findFirst({
        where: {
          projectId,
          userId,
          organizationId: this.tenantContext.organizationId,
          deletedAt: null,
        },
        select: { role: true },
      });
      projectRole = access?.role as ProjectRole | undefined;
    }

    if (hasPermission(orgRole, requiredPermission, projectRole)) {
      return true;
    }

    throw new ForbiddenException(
      `Missing permission: ${requiredPermission}`,
    );
  }
}
