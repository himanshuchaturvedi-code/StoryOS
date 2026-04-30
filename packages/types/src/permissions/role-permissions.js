"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROJECT_ROLE_PERMISSIONS = exports.ORG_ROLE_PERMISSIONS = void 0;
exports.orgRoleHasPermission = orgRoleHasPermission;
exports.projectRoleHasPermission = projectRoleHasPermission;
exports.hasPermission = hasPermission;
const enums_1 = require("../enums");
const permissions_1 = require("./permissions");
const ALL_PERMISSIONS = Object.values(permissions_1.PERMISSIONS);
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
exports.ORG_ROLE_PERMISSIONS = {
    [enums_1.OrgRole.OWNER]: ALL_PERMISSIONS,
    [enums_1.OrgRole.ADMIN]: ALL_PERMISSIONS.filter((p) => p !== permissions_1.PERMISSIONS.ORG_DELETE && p !== permissions_1.PERMISSIONS.ORG_MANAGE_BILLING),
    [enums_1.OrgRole.MEMBER]: [
        permissions_1.PERMISSIONS.ORG_READ,
        permissions_1.PERMISSIONS.PROJECT_CREATE,
        permissions_1.PERMISSIONS.PROJECT_READ,
        permissions_1.PERMISSIONS.PROJECT_METADATA_UPDATE,
        permissions_1.PERMISSIONS.PROJECT_FORMAT_UPDATE,
        permissions_1.PERMISSIONS.PROJECT_PHASE_MANAGE,
        permissions_1.PERMISSIONS.PROJECT_MILESTONE_MANAGE,
        permissions_1.PERMISSIONS.PARTICIPANT_CREATE,
        permissions_1.PERMISSIONS.PARTICIPANT_READ,
        permissions_1.PERMISSIONS.PARTICIPANT_UPDATE,
        permissions_1.PERMISSIONS.PERSON_CREATE,
        permissions_1.PERMISSIONS.PERSON_READ,
        permissions_1.PERMISSIONS.PERSON_UPDATE,
        permissions_1.PERMISSIONS.LOCATION_CREATE,
        permissions_1.PERMISSIONS.LOCATION_READ,
        permissions_1.PERMISSIONS.LOCATION_UPDATE,
        permissions_1.PERMISSIONS.DOCUMENT_UPLOAD,
        permissions_1.PERMISSIONS.DOCUMENT_READ,
        // Phase 2 — read-only financial access for MEMBER
        permissions_1.PERMISSIONS.BUDGET_TEMPLATE_READ,
        permissions_1.PERMISSIONS.BUDGET_READ,
        permissions_1.PERMISSIONS.BUDGET_VERSION_READ,
        permissions_1.PERMISSIONS.BUDGET_LINE_READ,
        permissions_1.PERMISSIONS.ACTUAL_READ,
        permissions_1.PERMISSIONS.FINANCE_PLAN_READ,
        // Phase 3 — read-only eligibility / activity access for MEMBER
        permissions_1.PERMISSIONS.VENDOR_READ,
        permissions_1.PERMISSIONS.VENDOR_ELIGIBILITY_READ,
        permissions_1.PERMISSIONS.ACTIVITY_DAY_READ,
        permissions_1.PERMISSIONS.EXPENSE_FACT_READ,
        permissions_1.PERMISSIONS.OWNERSHIP_READ,
        permissions_1.PERMISSIONS.RIGHTS_CONTROL_READ,
        permissions_1.PERMISSIONS.RESIDENCY_READ,
        // Phase 4 — read-only program / submission access for MEMBER
        permissions_1.PERMISSIONS.PROGRAM_READ,
        permissions_1.PERMISSIONS.PROJECT_PROGRAM_READ,
        permissions_1.PERMISSIONS.SUBMISSION_READ,
        permissions_1.PERMISSIONS.EVIDENCE_READ,
        permissions_1.PERMISSIONS.ASSESSMENT_READ,
    ],
};
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
exports.PROJECT_ROLE_PERMISSIONS = {
    [enums_1.ProjectRole.OWNER]: [
        permissions_1.PERMISSIONS.PROJECT_READ,
        permissions_1.PERMISSIONS.PROJECT_UPDATE,
        permissions_1.PERMISSIONS.PROJECT_DELETE,
        permissions_1.PERMISSIONS.PROJECT_MANAGE_ACCESS,
        permissions_1.PERMISSIONS.PROJECT_METADATA_UPDATE,
        permissions_1.PERMISSIONS.PROJECT_FORMAT_UPDATE,
        permissions_1.PERMISSIONS.PROJECT_STAGE_UPDATE,
        permissions_1.PERMISSIONS.PROJECT_PHASE_MANAGE,
        permissions_1.PERMISSIONS.PROJECT_MILESTONE_MANAGE,
        permissions_1.PERMISSIONS.PARTICIPANT_CREATE,
        permissions_1.PERMISSIONS.PARTICIPANT_READ,
        permissions_1.PERMISSIONS.PARTICIPANT_UPDATE,
        permissions_1.PERMISSIONS.PARTICIPANT_DELETE,
        permissions_1.PERMISSIONS.PERSON_CREATE,
        permissions_1.PERMISSIONS.PERSON_READ,
        permissions_1.PERMISSIONS.PERSON_UPDATE,
        permissions_1.PERMISSIONS.LOCATION_CREATE,
        permissions_1.PERMISSIONS.LOCATION_READ,
        permissions_1.PERMISSIONS.LOCATION_UPDATE,
        permissions_1.PERMISSIONS.DOCUMENT_UPLOAD,
        permissions_1.PERMISSIONS.DOCUMENT_READ,
        permissions_1.PERMISSIONS.DOCUMENT_DELETE,
        // Phase 2 — full financial access for project OWNER
        permissions_1.PERMISSIONS.BUDGET_TEMPLATE_READ,
        permissions_1.PERMISSIONS.BUDGET_CREATE,
        permissions_1.PERMISSIONS.BUDGET_READ,
        permissions_1.PERMISSIONS.BUDGET_UPDATE,
        permissions_1.PERMISSIONS.BUDGET_DELETE,
        permissions_1.PERMISSIONS.BUDGET_VERSION_CREATE,
        permissions_1.PERMISSIONS.BUDGET_VERSION_READ,
        permissions_1.PERMISSIONS.BUDGET_VERSION_LOCK,
        permissions_1.PERMISSIONS.BUDGET_LINE_CREATE,
        permissions_1.PERMISSIONS.BUDGET_LINE_READ,
        permissions_1.PERMISSIONS.BUDGET_LINE_UPDATE,
        permissions_1.PERMISSIONS.BUDGET_LINE_DELETE,
        permissions_1.PERMISSIONS.ACTUAL_CREATE,
        permissions_1.PERMISSIONS.ACTUAL_READ,
        permissions_1.PERMISSIONS.ACTUAL_UPDATE,
        permissions_1.PERMISSIONS.ACTUAL_DELETE,
        permissions_1.PERMISSIONS.FINANCE_PLAN_CREATE,
        permissions_1.PERMISSIONS.FINANCE_PLAN_READ,
        permissions_1.PERMISSIONS.FINANCE_PLAN_UPDATE,
        permissions_1.PERMISSIONS.FINANCE_PLAN_DELETE,
        // Phase 3 — full eligibility access for project OWNER
        permissions_1.PERMISSIONS.VENDOR_CREATE,
        permissions_1.PERMISSIONS.VENDOR_READ,
        permissions_1.PERMISSIONS.VENDOR_UPDATE,
        permissions_1.PERMISSIONS.VENDOR_DELETE,
        permissions_1.PERMISSIONS.VENDOR_ELIGIBILITY_CREATE,
        permissions_1.PERMISSIONS.VENDOR_ELIGIBILITY_READ,
        permissions_1.PERMISSIONS.VENDOR_ELIGIBILITY_UPDATE,
        permissions_1.PERMISSIONS.ACTIVITY_DAY_CREATE,
        permissions_1.PERMISSIONS.ACTIVITY_DAY_READ,
        permissions_1.PERMISSIONS.ACTIVITY_DAY_UPDATE,
        permissions_1.PERMISSIONS.ACTIVITY_DAY_DELETE,
        permissions_1.PERMISSIONS.EXPENSE_FACT_CREATE,
        permissions_1.PERMISSIONS.EXPENSE_FACT_READ,
        permissions_1.PERMISSIONS.EXPENSE_FACT_UPDATE,
        permissions_1.PERMISSIONS.EXPENSE_FACT_DELETE,
        permissions_1.PERMISSIONS.OWNERSHIP_CREATE,
        permissions_1.PERMISSIONS.OWNERSHIP_READ,
        permissions_1.PERMISSIONS.OWNERSHIP_UPDATE,
        permissions_1.PERMISSIONS.OWNERSHIP_DELETE,
        permissions_1.PERMISSIONS.RIGHTS_CONTROL_CREATE,
        permissions_1.PERMISSIONS.RIGHTS_CONTROL_READ,
        permissions_1.PERMISSIONS.RIGHTS_CONTROL_UPDATE,
        permissions_1.PERMISSIONS.RIGHTS_CONTROL_DELETE,
        permissions_1.PERMISSIONS.RESIDENCY_CREATE,
        permissions_1.PERMISSIONS.RESIDENCY_READ,
        permissions_1.PERMISSIONS.RESIDENCY_UPDATE,
        // Phase 4 — full program enrollment/submission access for project OWNER
        permissions_1.PERMISSIONS.PROGRAM_READ,
        permissions_1.PERMISSIONS.PROJECT_PROGRAM_CREATE,
        permissions_1.PERMISSIONS.PROJECT_PROGRAM_READ,
        permissions_1.PERMISSIONS.PROJECT_PROGRAM_UPDATE,
        permissions_1.PERMISSIONS.PROJECT_PROGRAM_DELETE,
        permissions_1.PERMISSIONS.SUBMISSION_CREATE,
        permissions_1.PERMISSIONS.SUBMISSION_READ,
        permissions_1.PERMISSIONS.SUBMISSION_UPDATE,
        permissions_1.PERMISSIONS.SUBMISSION_DELETE,
        permissions_1.PERMISSIONS.EVIDENCE_CREATE,
        permissions_1.PERMISSIONS.EVIDENCE_READ,
        permissions_1.PERMISSIONS.EVIDENCE_UPDATE,
        permissions_1.PERMISSIONS.EVIDENCE_DELETE,
        permissions_1.PERMISSIONS.ASSESSMENT_READ,
        permissions_1.PERMISSIONS.ASSESSMENT_UPDATE,
    ],
    [enums_1.ProjectRole.EDITOR]: [
        permissions_1.PERMISSIONS.PROJECT_READ,
        permissions_1.PERMISSIONS.PROJECT_UPDATE,
        permissions_1.PERMISSIONS.PROJECT_METADATA_UPDATE,
        permissions_1.PERMISSIONS.PROJECT_FORMAT_UPDATE,
        permissions_1.PERMISSIONS.PROJECT_PHASE_MANAGE,
        permissions_1.PERMISSIONS.PROJECT_MILESTONE_MANAGE,
        permissions_1.PERMISSIONS.PARTICIPANT_CREATE,
        permissions_1.PERMISSIONS.PARTICIPANT_READ,
        permissions_1.PERMISSIONS.PARTICIPANT_UPDATE,
        permissions_1.PERMISSIONS.PERSON_CREATE,
        permissions_1.PERMISSIONS.PERSON_READ,
        permissions_1.PERMISSIONS.PERSON_UPDATE,
        permissions_1.PERMISSIONS.LOCATION_CREATE,
        permissions_1.PERMISSIONS.LOCATION_READ,
        permissions_1.PERMISSIONS.LOCATION_UPDATE,
        permissions_1.PERMISSIONS.DOCUMENT_UPLOAD,
        permissions_1.PERMISSIONS.DOCUMENT_READ,
        // Phase 2 — read + write, no delete/lock
        permissions_1.PERMISSIONS.BUDGET_TEMPLATE_READ,
        permissions_1.PERMISSIONS.BUDGET_CREATE,
        permissions_1.PERMISSIONS.BUDGET_READ,
        permissions_1.PERMISSIONS.BUDGET_UPDATE,
        permissions_1.PERMISSIONS.BUDGET_VERSION_CREATE,
        permissions_1.PERMISSIONS.BUDGET_VERSION_READ,
        permissions_1.PERMISSIONS.BUDGET_LINE_CREATE,
        permissions_1.PERMISSIONS.BUDGET_LINE_READ,
        permissions_1.PERMISSIONS.BUDGET_LINE_UPDATE,
        permissions_1.PERMISSIONS.ACTUAL_CREATE,
        permissions_1.PERMISSIONS.ACTUAL_READ,
        permissions_1.PERMISSIONS.ACTUAL_UPDATE,
        permissions_1.PERMISSIONS.FINANCE_PLAN_CREATE,
        permissions_1.PERMISSIONS.FINANCE_PLAN_READ,
        permissions_1.PERMISSIONS.FINANCE_PLAN_UPDATE,
        // Phase 3 — read + write for EDITOR (no delete)
        permissions_1.PERMISSIONS.VENDOR_CREATE,
        permissions_1.PERMISSIONS.VENDOR_READ,
        permissions_1.PERMISSIONS.VENDOR_UPDATE,
        permissions_1.PERMISSIONS.VENDOR_ELIGIBILITY_CREATE,
        permissions_1.PERMISSIONS.VENDOR_ELIGIBILITY_READ,
        permissions_1.PERMISSIONS.VENDOR_ELIGIBILITY_UPDATE,
        permissions_1.PERMISSIONS.ACTIVITY_DAY_CREATE,
        permissions_1.PERMISSIONS.ACTIVITY_DAY_READ,
        permissions_1.PERMISSIONS.ACTIVITY_DAY_UPDATE,
        permissions_1.PERMISSIONS.EXPENSE_FACT_CREATE,
        permissions_1.PERMISSIONS.EXPENSE_FACT_READ,
        permissions_1.PERMISSIONS.EXPENSE_FACT_UPDATE,
        permissions_1.PERMISSIONS.OWNERSHIP_CREATE,
        permissions_1.PERMISSIONS.OWNERSHIP_READ,
        permissions_1.PERMISSIONS.OWNERSHIP_UPDATE,
        permissions_1.PERMISSIONS.RIGHTS_CONTROL_CREATE,
        permissions_1.PERMISSIONS.RIGHTS_CONTROL_READ,
        permissions_1.PERMISSIONS.RIGHTS_CONTROL_UPDATE,
        permissions_1.PERMISSIONS.RESIDENCY_CREATE,
        permissions_1.PERMISSIONS.RESIDENCY_READ,
        permissions_1.PERMISSIONS.RESIDENCY_UPDATE,
        // Phase 4 — read + write for EDITOR (no delete)
        permissions_1.PERMISSIONS.PROGRAM_READ,
        permissions_1.PERMISSIONS.PROJECT_PROGRAM_CREATE,
        permissions_1.PERMISSIONS.PROJECT_PROGRAM_READ,
        permissions_1.PERMISSIONS.PROJECT_PROGRAM_UPDATE,
        permissions_1.PERMISSIONS.SUBMISSION_CREATE,
        permissions_1.PERMISSIONS.SUBMISSION_READ,
        permissions_1.PERMISSIONS.SUBMISSION_UPDATE,
        permissions_1.PERMISSIONS.EVIDENCE_CREATE,
        permissions_1.PERMISSIONS.EVIDENCE_READ,
        permissions_1.PERMISSIONS.EVIDENCE_UPDATE,
        permissions_1.PERMISSIONS.ASSESSMENT_READ,
    ],
    [enums_1.ProjectRole.VIEWER]: [
        permissions_1.PERMISSIONS.PROJECT_READ,
        permissions_1.PERMISSIONS.PARTICIPANT_READ,
        permissions_1.PERMISSIONS.PERSON_READ,
        permissions_1.PERMISSIONS.LOCATION_READ,
        permissions_1.PERMISSIONS.DOCUMENT_READ,
        // Phase 2 — read-only financial access
        permissions_1.PERMISSIONS.BUDGET_TEMPLATE_READ,
        permissions_1.PERMISSIONS.BUDGET_READ,
        permissions_1.PERMISSIONS.BUDGET_VERSION_READ,
        permissions_1.PERMISSIONS.BUDGET_LINE_READ,
        permissions_1.PERMISSIONS.ACTUAL_READ,
        permissions_1.PERMISSIONS.FINANCE_PLAN_READ,
        // Phase 3 — read-only eligibility access
        permissions_1.PERMISSIONS.VENDOR_READ,
        permissions_1.PERMISSIONS.VENDOR_ELIGIBILITY_READ,
        permissions_1.PERMISSIONS.ACTIVITY_DAY_READ,
        permissions_1.PERMISSIONS.EXPENSE_FACT_READ,
        permissions_1.PERMISSIONS.OWNERSHIP_READ,
        permissions_1.PERMISSIONS.RIGHTS_CONTROL_READ,
        permissions_1.PERMISSIONS.RESIDENCY_READ,
        // Phase 4 — read-only program/submission access
        permissions_1.PERMISSIONS.PROGRAM_READ,
        permissions_1.PERMISSIONS.PROJECT_PROGRAM_READ,
        permissions_1.PERMISSIONS.SUBMISSION_READ,
        permissions_1.PERMISSIONS.EVIDENCE_READ,
        permissions_1.PERMISSIONS.ASSESSMENT_READ,
    ],
};
/**
 * Resolves whether a given org role grants a permission.
 */
function orgRoleHasPermission(role, permission) {
    return exports.ORG_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
/**
 * Resolves whether a given project role grants a permission.
 */
function projectRoleHasPermission(role, permission) {
    return exports.PROJECT_ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
/**
 * Returns true if the user has the permission via either their org role
 * or their project-specific role. Project role is only evaluated when provided.
 */
function hasPermission(orgRole, permission, projectRole) {
    if (orgRoleHasPermission(orgRole, permission))
        return true;
    if (projectRole && projectRoleHasPermission(projectRole, permission))
        return true;
    return false;
}
//# sourceMappingURL=role-permissions.js.map