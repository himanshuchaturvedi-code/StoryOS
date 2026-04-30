/**
 * Budget-derived incentive role assignment types.
 *
 * Roles are computed from BudgetAccountRoleMapping + BudgetLine assignments,
 * scoped to a specific BudgetVersion. Only labour lines contribute.
 */

export type DerivedRoleWarningCode =
  | 'NON_LABOUR_LINE'
  | 'AMBIGUOUS_ASSIGNMENT'
  | 'MISSING_PERSON'
  | 'MISSING_RESIDENCY'
  | 'NON_PERSON_PARTY'
  | 'MISSING_ROLE'
  | 'PROGRAM_ROLE_MAPPING_MISSING';

export type DerivedRoleWarningSeverity = 'info' | 'warning' | 'error';

export interface DerivedRoleWarning {
  code: DerivedRoleWarningCode;
  severity: DerivedRoleWarningSeverity;
  roleCode: string | null;
  programCode: string;
  message: string;
  affectedBudgetLineIds?: string[];
  affectedPersonIds?: string[];
}

export type ExcludedLineReason =
  | 'NON_LABOUR_LINE'
  | 'MISSING_PERSON'
  | 'NON_PERSON_PARTY'
  | 'MISSING_RESIDENCY'
  | 'ROLE_NOT_MAPPED';

export interface ExcludedLine {
  budgetLineId: string;
  budgetAccountCode: string;
  amount: string;
  reason: ExcludedLineReason;
  personId?: string;
  vendorId?: string;
}

export interface DerivedRoleAssignment {
  personId: string;
  personName: string;
  budgetLineId: string;
  budgetAccountId: string;
  budgetAccountCode: string;
  roleCode: string;
  programCode: string;
  /**
   * Used ONLY for role/person attribution and eligibility thresholds.
   * If a single GL is mapped to multiple roles, this amount WILL appear under multiple mapped roles.
   * MUST NEVER be used to sum up total eligible labour costs (use SpendRecords instead).
   */
  labourAmountForTrace: string;
  residency: {
    residencyType: string;
    country: string;
    provinceState: string | null;
  } | null;
  pointsOverride: number | null;
}

export interface DiscardedAssignment {
  assignment: DerivedRoleAssignment;
  reason: 'Lower labour amount' | 'Tie-breaker order';
}

export interface DerivedRoleResolution {
  roleCode: string;
  programCode: string;
  selectedAssignment: DerivedRoleAssignment | null;
  discardedAssignments: DiscardedAssignment[];
  excludedLines: ExcludedLine[];
}

export interface DerivedRolesResult {
  budgetVersionId: string;
  programCode: string;
  roles: DerivedRoleResolution[];
  warnings: DerivedRoleWarning[];
}

export interface DerivedRoleSummary {
  totalPoints: number | null;
  maxPoints: number | null;
  missingRoles: string[];
  issues: string[];
}

export interface DerivedRoleResolutionWithAccounts extends Omit<DerivedRoleResolution, 'programCode'> {
  mappedAccountIds: string[];
}

export interface ProgramDerivedRoles {
  programCode: string;
  programName: string;
  roles: DerivedRoleResolutionWithAccounts[];
  warnings: DerivedRoleWarning[];
  summary: DerivedRoleSummary;
}

export interface DerivedRolesResponse {
  budgetVersionId: string;
  programs: ProgramDerivedRoles[];
}
