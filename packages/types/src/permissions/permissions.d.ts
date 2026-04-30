/**
 * All platform permissions as typed string literals.
 *
 * Naming convention: `resource:action`
 *
 * These constants are referenced by:
 * - PermissionGuard (apps/api) — enforces access on protected routes
 * - RequirePermission decorator (apps/api) — declares required permission per route
 * - UI permission checks (apps/web) — hides/shows actions in the interface
 *
 * IMPORTANT: Frontend permission checks are UI hints only.
 * All authorization is enforced server-side by PermissionGuard.
 */
export declare const PERMISSIONS: {
    readonly ORG_READ: "org:read";
    readonly ORG_UPDATE: "org:update";
    readonly ORG_DELETE: "org:delete";
    readonly ORG_MANAGE_MEMBERS: "org:manage_members";
    readonly ORG_MANAGE_BILLING: "org:manage_billing";
    readonly PROJECT_CREATE: "project:create";
    readonly PROJECT_READ: "project:read";
    readonly PROJECT_UPDATE: "project:update";
    readonly PROJECT_DELETE: "project:delete";
    readonly PROJECT_MANAGE_ACCESS: "project:manage_access";
    readonly PROJECT_METADATA_UPDATE: "project_metadata:update";
    readonly PROJECT_FORMAT_UPDATE: "project_format:update";
    readonly PROJECT_STAGE_UPDATE: "project_stage:update";
    readonly PROJECT_PHASE_MANAGE: "project_phase:manage";
    readonly PROJECT_MILESTONE_MANAGE: "project_milestone:manage";
    readonly PARTICIPANT_CREATE: "participant:create";
    readonly PARTICIPANT_READ: "participant:read";
    readonly PARTICIPANT_UPDATE: "participant:update";
    readonly PARTICIPANT_DELETE: "participant:delete";
    readonly PERSON_CREATE: "person:create";
    readonly PERSON_READ: "person:read";
    readonly PERSON_UPDATE: "person:update";
    readonly PERSON_DELETE: "person:delete";
    readonly LOCATION_CREATE: "location:create";
    readonly LOCATION_READ: "location:read";
    readonly LOCATION_UPDATE: "location:update";
    readonly LOCATION_DELETE: "location:delete";
    readonly DOCUMENT_UPLOAD: "document:upload";
    readonly DOCUMENT_READ: "document:read";
    readonly DOCUMENT_DELETE: "document:delete";
    readonly INVITATION_CREATE: "invitation:create";
    readonly INVITATION_REVOKE: "invitation:revoke";
    readonly INVITATION_LIST: "invitation:list";
    readonly BUDGET_TEMPLATE_CREATE: "budget_template:create";
    readonly BUDGET_TEMPLATE_READ: "budget_template:read";
    readonly BUDGET_TEMPLATE_UPDATE: "budget_template:update";
    readonly BUDGET_TEMPLATE_DELETE: "budget_template:delete";
    readonly BUDGET_CREATE: "budget:create";
    readonly BUDGET_READ: "budget:read";
    readonly BUDGET_UPDATE: "budget:update";
    readonly BUDGET_DELETE: "budget:delete";
    readonly BUDGET_VERSION_CREATE: "budget_version:create";
    readonly BUDGET_VERSION_READ: "budget_version:read";
    readonly BUDGET_VERSION_LOCK: "budget_version:lock";
    readonly BUDGET_LINE_CREATE: "budget_line:create";
    readonly BUDGET_LINE_READ: "budget_line:read";
    readonly BUDGET_LINE_UPDATE: "budget_line:update";
    readonly BUDGET_LINE_DELETE: "budget_line:delete";
    readonly ACTUAL_CREATE: "actual:create";
    readonly ACTUAL_READ: "actual:read";
    readonly ACTUAL_UPDATE: "actual:update";
    readonly ACTUAL_DELETE: "actual:delete";
    readonly FINANCE_PLAN_CREATE: "finance_plan:create";
    readonly FINANCE_PLAN_READ: "finance_plan:read";
    readonly FINANCE_PLAN_UPDATE: "finance_plan:update";
    readonly FINANCE_PLAN_DELETE: "finance_plan:delete";
    readonly VENDOR_CREATE: "vendor:create";
    readonly VENDOR_READ: "vendor:read";
    readonly VENDOR_UPDATE: "vendor:update";
    readonly VENDOR_DELETE: "vendor:delete";
    readonly VENDOR_ELIGIBILITY_CREATE: "vendor_eligibility:create";
    readonly VENDOR_ELIGIBILITY_READ: "vendor_eligibility:read";
    readonly VENDOR_ELIGIBILITY_UPDATE: "vendor_eligibility:update";
    readonly ACTIVITY_DAY_CREATE: "activity_day:create";
    readonly ACTIVITY_DAY_READ: "activity_day:read";
    readonly ACTIVITY_DAY_UPDATE: "activity_day:update";
    readonly ACTIVITY_DAY_DELETE: "activity_day:delete";
    readonly EXPENSE_FACT_CREATE: "expense_fact:create";
    readonly EXPENSE_FACT_READ: "expense_fact:read";
    readonly EXPENSE_FACT_UPDATE: "expense_fact:update";
    readonly EXPENSE_FACT_DELETE: "expense_fact:delete";
    readonly OWNERSHIP_CREATE: "ownership:create";
    readonly OWNERSHIP_READ: "ownership:read";
    readonly OWNERSHIP_UPDATE: "ownership:update";
    readonly OWNERSHIP_DELETE: "ownership:delete";
    readonly RIGHTS_CONTROL_CREATE: "rights_control:create";
    readonly RIGHTS_CONTROL_READ: "rights_control:read";
    readonly RIGHTS_CONTROL_UPDATE: "rights_control:update";
    readonly RIGHTS_CONTROL_DELETE: "rights_control:delete";
    readonly RESIDENCY_CREATE: "residency:create";
    readonly RESIDENCY_READ: "residency:read";
    readonly RESIDENCY_UPDATE: "residency:update";
    readonly PROGRAM_READ: "program:read";
    readonly PROJECT_PROGRAM_CREATE: "project_program:create";
    readonly PROJECT_PROGRAM_READ: "project_program:read";
    readonly PROJECT_PROGRAM_UPDATE: "project_program:update";
    readonly PROJECT_PROGRAM_DELETE: "project_program:delete";
    readonly SUBMISSION_CREATE: "submission:create";
    readonly SUBMISSION_READ: "submission:read";
    readonly SUBMISSION_UPDATE: "submission:update";
    readonly SUBMISSION_DELETE: "submission:delete";
    readonly EVIDENCE_CREATE: "evidence:create";
    readonly EVIDENCE_READ: "evidence:read";
    readonly EVIDENCE_UPDATE: "evidence:update";
    readonly EVIDENCE_DELETE: "evidence:delete";
    readonly ASSESSMENT_READ: "assessment:read";
    readonly ASSESSMENT_UPDATE: "assessment:update";
};
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
//# sourceMappingURL=permissions.d.ts.map