import { SetMetadata } from '@nestjs/common';
import { type Permission } from '@storyos/types';

export const PERMISSION_KEY = 'required_permission';

/**
 * Declares the permission required to access a route.
 * Evaluated by PermissionGuard (Phase 1B).
 *
 * @example
 *   @UseGuards(AuthGuard, TenantGuard, PermissionGuard)
 *   @RequirePermission(PERMISSIONS.PROJECT_UPDATE)
 *   @Patch(':id')
 *   async update() { ... }
 */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);
