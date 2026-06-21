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
export const PERMISSIONS = {
  // ── Organization ─────────────────────────────
  ORG_READ: 'org:read',
  ORG_UPDATE: 'org:update',
  ORG_DELETE: 'org:delete',
  ORG_MANAGE_MEMBERS: 'org:manage_members',
  ORG_MANAGE_BILLING: 'org:manage_billing',

  // ── Projects ─────────────────────────────────
  PROJECT_CREATE: 'project:create',
  PROJECT_READ: 'project:read',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_MANAGE_ACCESS: 'project:manage_access',

  // ── Project Metadata ─────────────────────────
  PROJECT_METADATA_UPDATE: 'project_metadata:update',
  PROJECT_FORMAT_UPDATE: 'project_format:update',
  PROJECT_STAGE_UPDATE: 'project_stage:update',
  PROJECT_PHASE_MANAGE: 'project_phase:manage',
  PROJECT_MILESTONE_MANAGE: 'project_milestone:manage',

  // ── Participants ──────────────────────────────
  PARTICIPANT_CREATE: 'participant:create',
  PARTICIPANT_READ: 'participant:read',
  PARTICIPANT_UPDATE: 'participant:update',
  PARTICIPANT_DELETE: 'participant:delete',

  // ── Persons ───────────────────────────────────
  PERSON_CREATE: 'person:create',
  PERSON_READ: 'person:read',
  PERSON_UPDATE: 'person:update',
  PERSON_DELETE: 'person:delete',

  // ── Locations ────────────────────────────────
  LOCATION_CREATE: 'location:create',
  LOCATION_READ: 'location:read',
  LOCATION_UPDATE: 'location:update',
  LOCATION_DELETE: 'location:delete',

  // ── Documents ────────────────────────────────
  DOCUMENT_UPLOAD: 'document:upload',
  DOCUMENT_READ: 'document:read',
  DOCUMENT_DELETE: 'document:delete',

  // ── Invitations ──────────────────────────────
  INVITATION_CREATE: 'invitation:create',
  INVITATION_REVOKE: 'invitation:revoke',
  INVITATION_LIST: 'invitation:list',

  // ── Budget Templates (Phase 2) ────────
  BUDGET_TEMPLATE_CREATE: 'budget_template:create',
  BUDGET_TEMPLATE_READ: 'budget_template:read',
  BUDGET_TEMPLATE_UPDATE: 'budget_template:update',
  BUDGET_TEMPLATE_DELETE: 'budget_template:delete',

  // ── Budgets (Phase 2) ─────────────────
  BUDGET_CREATE: 'budget:create',
  BUDGET_READ: 'budget:read',
  BUDGET_UPDATE: 'budget:update',
  BUDGET_DELETE: 'budget:delete',

  // ── Budget Versions (Phase 2) ─────────
  BUDGET_VERSION_CREATE: 'budget_version:create',
  BUDGET_VERSION_READ: 'budget_version:read',
  BUDGET_VERSION_LOCK: 'budget_version:lock',

  // ── Budget Lines (Phase 2) ────────────
  BUDGET_LINE_CREATE: 'budget_line:create',
  BUDGET_LINE_READ: 'budget_line:read',
  BUDGET_LINE_UPDATE: 'budget_line:update',
  BUDGET_LINE_DELETE: 'budget_line:delete',
  BUDGET_LINE_ANNOTATE: 'budget_line:annotate',

  // ── Actuals (Phase 2) ─────────────────
  ACTUAL_CREATE: 'actual:create',
  ACTUAL_READ: 'actual:read',
  ACTUAL_UPDATE: 'actual:update',
  ACTUAL_DELETE: 'actual:delete',

  // ── Finance Plans (Phase 2) ───────────
  FINANCE_PLAN_CREATE: 'finance_plan:create',
  FINANCE_PLAN_READ: 'finance_plan:read',
  FINANCE_PLAN_UPDATE: 'finance_plan:update',
  FINANCE_PLAN_DELETE: 'finance_plan:delete',

  // ── Vendors (Phase 3) ──────────────────
  VENDOR_CREATE: 'vendor:create',
  VENDOR_READ: 'vendor:read',
  VENDOR_UPDATE: 'vendor:update',
  VENDOR_DELETE: 'vendor:delete',

  // ── Vendor Eligibility (Phase 3) ───────
  VENDOR_ELIGIBILITY_CREATE: 'vendor_eligibility:create',
  VENDOR_ELIGIBILITY_READ: 'vendor_eligibility:read',
  VENDOR_ELIGIBILITY_UPDATE: 'vendor_eligibility:update',

  // ── Activity Days (Phase 3) ────────────
  ACTIVITY_DAY_CREATE: 'activity_day:create',
  ACTIVITY_DAY_READ: 'activity_day:read',
  ACTIVITY_DAY_UPDATE: 'activity_day:update',
  ACTIVITY_DAY_DELETE: 'activity_day:delete',

  // ── Expense Facts (Phase 3) ────────────
  EXPENSE_FACT_CREATE: 'expense_fact:create',
  EXPENSE_FACT_READ: 'expense_fact:read',
  EXPENSE_FACT_UPDATE: 'expense_fact:update',
  EXPENSE_FACT_DELETE: 'expense_fact:delete',

  // ── Corporate Ownership (Phase 3) ──────
  OWNERSHIP_CREATE: 'ownership:create',
  OWNERSHIP_READ: 'ownership:read',
  OWNERSHIP_UPDATE: 'ownership:update',
  OWNERSHIP_DELETE: 'ownership:delete',

  // ── Rights Control (Phase 3) ───────────
  RIGHTS_CONTROL_CREATE: 'rights_control:create',
  RIGHTS_CONTROL_READ: 'rights_control:read',
  RIGHTS_CONTROL_UPDATE: 'rights_control:update',
  RIGHTS_CONTROL_DELETE: 'rights_control:delete',

  // ── Participant Residency (Phase 3) ────
  RESIDENCY_CREATE: 'residency:create',
  RESIDENCY_READ: 'residency:read',
  RESIDENCY_UPDATE: 'residency:update',

  // ── Programs (Phase 4 — global, read-only for tenants V1) ──
  PROGRAM_READ: 'program:read',

  // ── Project Programs (Phase 4 — tenant enrollment) ──
  PROJECT_PROGRAM_CREATE: 'project_program:create',
  PROJECT_PROGRAM_READ: 'project_program:read',
  PROJECT_PROGRAM_UPDATE: 'project_program:update',
  PROJECT_PROGRAM_DELETE: 'project_program:delete',

  // ── Program Submissions (Phase 4) ──────
  SUBMISSION_CREATE: 'submission:create',
  SUBMISSION_READ: 'submission:read',
  SUBMISSION_UPDATE: 'submission:update',
  SUBMISSION_DELETE: 'submission:delete',

  // ── Program Applications (Phase 4+) ────
  PROGRAM_APPLICATION_CREATE: 'program_application:create',
  PROGRAM_APPLICATION_READ: 'program_application:read',
  PROGRAM_APPLICATION_UPDATE: 'program_application:update',

  // ── Submission Evidence (Phase 4) ──────
  EVIDENCE_CREATE: 'evidence:create',
  EVIDENCE_READ: 'evidence:read',
  EVIDENCE_UPDATE: 'evidence:update',
  EVIDENCE_DELETE: 'evidence:delete',

  // ── Requirement Assessments (Phase 4) ──
  ASSESSMENT_READ: 'assessment:read',
  ASSESSMENT_UPDATE: 'assessment:update',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
