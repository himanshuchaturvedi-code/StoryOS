import { Injectable, Scope, InternalServerErrorException } from '@nestjs/common';
import { OrgRole } from '@storyos/types';

/**
 * Request-scoped tenant context.
 *
 * Injected by TenantGuard (Phase 1B) after validating:
 * 1. JWT is valid (AuthGuard)
 * 2. User is a member of the requested organization (TenantGuard)
 *
 * Every service that extends TenantAwareService receives this automatically.
 *
 * SECURITY: This context is constructed server-side from the validated JWT and
 * database membership record. It is never derived from request body or query params.
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  private _organizationId: string | null = null;
  private _userId: string | null = null;
  private _orgRole: OrgRole | null = null;

  initialize(organizationId: string, userId: string, orgRole: OrgRole): void {
    this._organizationId = organizationId;
    this._userId = userId;
    this._orgRole = orgRole;
  }

  get organizationId(): string {
    if (!this._organizationId) {
      throw new InternalServerErrorException(
        'TenantContext.organizationId accessed before initialization. Ensure TenantGuard is applied to this route.',
      );
    }
    return this._organizationId;
  }

  get userId(): string {
    if (!this._userId) {
      throw new InternalServerErrorException(
        'TenantContext.userId accessed before initialization.',
      );
    }
    return this._userId;
  }

  get orgRole(): OrgRole {
    if (!this._orgRole) {
      throw new InternalServerErrorException(
        'TenantContext.orgRole accessed before initialization.',
      );
    }
    return this._orgRole;
  }

  get isInitialized(): boolean {
    return this._organizationId !== null;
  }
}
