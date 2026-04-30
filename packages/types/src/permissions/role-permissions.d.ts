import { OrgRole, ProjectRole } from '../enums';
import { type Permission } from './permissions';
/**
 * Permissions granted by organization-level roles.
 *
 * These are evaluated against the user's OrganizationMember.role.
 * They govern what the user can do within the organization context.
 *
 * OWNER  → full platform access within the org
 * ADMIN  → operational access, no billing or org deletion
 * MEMBER → read-only org + project creation + participant management
 */
export declare const ORG_ROLE_PERMISSIONS: Record<OrgRole, Permission[]>;
/**
 * Permissions granted by project-level roles.
 *
 * These are evaluated against the user's ProjectAccess.role for a specific project.
 * Project-level permissions are additive to org-level permissions — they grant
 * access to a specific project even if the user doesn't have an org-wide grant.
 *
 * OWNER  → full project access including deletion and access management
 * EDITOR → read and write, no deletion or access management
 * VIEWER → read-only
 */
export declare const PROJECT_ROLE_PERMISSIONS: Record<ProjectRole, Permission[]>;
/**
 * Resolves whether a given org role grants a permission.
 */
export declare function orgRoleHasPermission(role: OrgRole, permission: Permission): boolean;
/**
 * Resolves whether a given project role grants a permission.
 */
export declare function projectRoleHasPermission(role: ProjectRole, permission: Permission): boolean;
/**
 * Returns true if the user has the permission via either their org role
 * or their project-specific role. Project role is only evaluated when provided.
 */
export declare function hasPermission(orgRole: OrgRole, permission: Permission, projectRole?: ProjectRole): boolean;
//# sourceMappingURL=role-permissions.d.ts.map