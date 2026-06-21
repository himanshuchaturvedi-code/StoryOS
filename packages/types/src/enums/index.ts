// ──────────────────────────────────────────
// Organization
// ──────────────────────────────────────────

export enum OrgType {
  PRODUCTION_COMPANY = 'PRODUCTION_COMPANY',
  AGENCY = 'AGENCY',
  DISTRIBUTOR = 'DISTRIBUTOR',
  OTHER = 'OTHER',
}

export enum OrgRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

// ──────────────────────────────────────────
// Project
// ──────────────────────────────────────────

export enum ProjectStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum ProjectRole {
  OWNER = 'OWNER',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export enum Stage {
  DEVELOPMENT = 'DEVELOPMENT',
  PRE_PRODUCTION = 'PRE_PRODUCTION',
  PRODUCTION = 'PRODUCTION',
  POST_PRODUCTION = 'POST_PRODUCTION',
  COMPLETED = 'COMPLETED',
}

export enum PhaseType {
  DEVELOPMENT = 'DEVELOPMENT',
  PRE_PRODUCTION = 'PRE_PRODUCTION',
  PRINCIPAL_PHOTOGRAPHY = 'PRINCIPAL_PHOTOGRAPHY',
  POST_PRODUCTION = 'POST_PRODUCTION',
  VFX = 'VFX',
  ANIMATION = 'ANIMATION',
  SOUND_MIX = 'SOUND_MIX',
  COLOR_GRADE = 'COLOR_GRADE',
  MUSIC = 'MUSIC',
  OTHER = 'OTHER',
}

export enum FormatType {
  FEATURE_FILM = 'FEATURE_FILM',
  TV_SERIES = 'TV_SERIES',
  TV_MOVIE = 'TV_MOVIE',
  SHORT_FILM = 'SHORT_FILM',
  DOCUMENTARY_FEATURE = 'DOCUMENTARY_FEATURE',
  DOCUMENTARY_SERIES = 'DOCUMENTARY_SERIES',
  WEB_SERIES = 'WEB_SERIES',
  ANIMATION_SERIES = 'ANIMATION_SERIES',
  ANIMATION_FEATURE = 'ANIMATION_FEATURE',
  OTHER = 'OTHER',
}

// ──────────────────────────────────────────
// People
// ──────────────────────────────────────────

export enum RoleCategory {
  ABOVE_THE_LINE = 'ABOVE_THE_LINE',
  BELOW_THE_LINE = 'BELOW_THE_LINE',
  KEY_CREATIVE = 'KEY_CREATIVE',
  CAST = 'CAST',
  OTHER = 'OTHER',
}

// ──────────────────────────────────────────
// Geography
// ──────────────────────────────────────────

export enum LocationType {
  STUDIO = 'STUDIO',
  ON_LOCATION = 'ON_LOCATION',
  OFFICE = 'OFFICE',
  POST_FACILITY = 'POST_FACILITY',
  VFX_FACILITY = 'VFX_FACILITY',
  OTHER = 'OTHER',
}

// ──────────────────────────────────────────
// Documents
// ──────────────────────────────────────────

export enum DocumentCategory {
  SCRIPT = 'SCRIPT',
  BUDGET = 'BUDGET',
  SCHEDULE = 'SCHEDULE',
  CONTRACT = 'CONTRACT',
  CHAIN_OF_TITLE = 'CHAIN_OF_TITLE',
  INSURANCE = 'INSURANCE',
  FINANCING = 'FINANCING',
  CORPORATE = 'CORPORATE',
  CORRESPONDENCE = 'CORRESPONDENCE',
  CAVCO_PART_A = 'CAVCO_PART_A',
  CAVCO_PART_B = 'CAVCO_PART_B',
  ELIGIBILITY_CERTIFICATE = 'ELIGIBILITY_CERTIFICATE',
  VFX_ACTIVITY_REPORT = 'VFX_ACTIVITY_REPORT',
  TAX_CLAIM_FORM = 'TAX_CLAIM_FORM',
  COMPLETION_CERTIFICATE = 'COMPLETION_CERTIFICATE',
  BROADCASTER_COMMITMENT = 'BROADCASTER_COMMITMENT',
  DISTRIBUTION_COMMITMENT = 'DISTRIBUTION_COMMITMENT',
  OTHER = 'OTHER',
}

// ──────────────────────────────────────────
// Budget / Finance (Phase 2)
// ──────────────────────────────────────────

/** Industry-standard top-sheet categories for production budgets. */
export enum BudgetAccountType {
  ABOVE_THE_LINE = 'ABOVE_THE_LINE',
  BELOW_THE_LINE_PRODUCTION = 'BELOW_THE_LINE_PRODUCTION',
  BELOW_THE_LINE_POST = 'BELOW_THE_LINE_POST',
  OTHER = 'OTHER',
}

export enum CptcRole {
  DIRECTOR = 'DIRECTOR',
  SCREENWRITER = 'SCREENWRITER',
  LEAD_PERFORMER_1 = 'LEAD_PERFORMER_1',
  LEAD_PERFORMER_2 = 'LEAD_PERFORMER_2',
  DIRECTOR_OF_PHOTOGRAPHY = 'DIRECTOR_OF_PHOTOGRAPHY',
  ART_DIRECTOR = 'ART_DIRECTOR',
  MUSIC_COMPOSER = 'MUSIC_COMPOSER',
  PICTURE_EDITOR = 'PICTURE_EDITOR',
}

export enum BudgetVersionStatus {
  DRAFT = 'DRAFT',
  LOCKED = 'LOCKED',
}

/** Standard Canadian production financing instruments. */
export enum FinanceSourceType {
  FEDERAL_TAX_CREDIT = 'FEDERAL_TAX_CREDIT',
  PROVINCIAL_TAX_CREDIT = 'PROVINCIAL_TAX_CREDIT',
  BROADCASTER_LICENSE = 'BROADCASTER_LICENSE',
  DISTRIBUTION_ADVANCE = 'DISTRIBUTION_ADVANCE',
  PRE_SALE = 'PRE_SALE',
  EQUITY = 'EQUITY',
  GAP_FINANCING = 'GAP_FINANCING',
  GRANT = 'GRANT',
  DEFERRAL = 'DEFERRAL',
  OTHER = 'OTHER',
}

export enum FinanceSourceStatus {
  ESTIMATED = 'ESTIMATED',
  COMMITTED = 'COMMITTED',
  RECEIVED = 'RECEIVED',
}

// ──────────────────────────────────────────
// Budget Eligibility Annotation (Phase 5)
// ──────────────────────────────────────────

export enum ExpenseType {
  LABOUR = 'LABOUR',
  NON_LABOUR = 'NON_LABOUR',
  MIXED = 'MIXED',
}

export enum ActivityType {
  GENERAL = 'GENERAL',
  DIGITAL_ANIMATION = 'DIGITAL_ANIMATION',
  VISUAL_EFFECTS = 'VISUAL_EFFECTS',
  POST_PRODUCTION = 'POST_PRODUCTION',
}

export enum EvaluationSource {
  BUDGET = 'BUDGET',
  ACTUAL = 'ACTUAL',
  BLENDED = 'BLENDED',
}

// ──────────────────────────────────────────
// Vendor / Eligibility / Activity (Phase 3)
// ──────────────────────────────────────────

export enum VendorType {
  PRODUCTION_SERVICE = 'PRODUCTION_SERVICE',
  POST_PRODUCTION = 'POST_PRODUCTION',
  VFX = 'VFX',
  ANIMATION = 'ANIMATION',
  SOUND = 'SOUND',
  MUSIC = 'MUSIC',
  EQUIPMENT_RENTAL = 'EQUIPMENT_RENTAL',
  STUDIO_RENTAL = 'STUDIO_RENTAL',
  CATERING = 'CATERING',
  TRANSPORTATION = 'TRANSPORTATION',
  INSURANCE = 'INSURANCE',
  LEGAL = 'LEGAL',
  OTHER = 'OTHER',
}

export enum EligibilityStatus {
  ELIGIBLE = 'ELIGIBLE',
  NOT_ELIGIBLE = 'NOT_ELIGIBLE',
  UNDER_REVIEW = 'UNDER_REVIEW',
  EXPIRED = 'EXPIRED',
}

export enum ControlType {
  CREATIVE_CONTROL = 'CREATIVE_CONTROL',
  FINANCIAL_CONTROL = 'FINANCIAL_CONTROL',
  COPYRIGHT_OWNERSHIP = 'COPYRIGHT_OWNERSHIP',
  DISTRIBUTION_RIGHTS = 'DISTRIBUTION_RIGHTS',
  UNDERLYING_RIGHTS = 'UNDERLYING_RIGHTS',
}

export enum ResidencyType {
  CITIZEN = 'CITIZEN',
  PERMANENT_RESIDENT = 'PERMANENT_RESIDENT',
  TEMPORARY_RESIDENT = 'TEMPORARY_RESIDENT',
  NON_RESIDENT = 'NON_RESIDENT',
}

// ──────────────────────────────────────────
// Program & Incentive Framework (Phase 4)
// ──────────────────────────────────────────

export enum ProgramScope {
  FEDERAL = 'FEDERAL',
  PROVINCIAL = 'PROVINCIAL',
  MUNICIPAL = 'MUNICIPAL',
  PRIVATE_FUND = 'PRIVATE_FUND',
  INTERNATIONAL = 'INTERNATIONAL',
}

export enum RequirementCategory {
  EXPENDITURE_THRESHOLD = 'EXPENDITURE_THRESHOLD',
  LABOUR_EXPENDITURE = 'LABOUR_EXPENDITURE',
  KEY_CREATIVE_TEST = 'KEY_CREATIVE_TEST',
  CANADIAN_CONTROL = 'CANADIAN_CONTROL',
  RESIDENCY_TEST = 'RESIDENCY_TEST',
  ACTIVITY_DAY_MINIMUM = 'ACTIVITY_DAY_MINIMUM',
  REGIONAL_SPEND = 'REGIONAL_SPEND',
  FORMAT_ELIGIBILITY = 'FORMAT_ELIGIBILITY',
  VENDOR_ELIGIBILITY = 'VENDOR_ELIGIBILITY',
  RIGHTS_CONTROL = 'RIGHTS_CONTROL',
  PRODUCER_CREDIT = 'PRODUCER_CREDIT',
  DOCUMENTATION = 'DOCUMENTATION',
  CUSTOM = 'CUSTOM',
}

export enum FactSourceType {
  EXPENSE_FACT = 'EXPENSE_FACT',
  ACTIVITY_DAY = 'ACTIVITY_DAY',
  VENDOR_ELIGIBILITY = 'VENDOR_ELIGIBILITY',
  PARTICIPANT_RESIDENCY = 'PARTICIPANT_RESIDENCY',
  CORPORATE_OWNERSHIP = 'CORPORATE_OWNERSHIP',
  PROJECT_OWNERSHIP = 'PROJECT_OWNERSHIP',
  RIGHTS_CONTROL_FACT = 'RIGHTS_CONTROL_FACT',
  BUDGET_ACTUAL = 'BUDGET_ACTUAL',
  PROJECT_FORMAT = 'PROJECT_FORMAT',
  PROJECT_METADATA = 'PROJECT_METADATA',
  DOCUMENT = 'DOCUMENT',
}

export enum ProjectProgramStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ABANDONED = 'ABANDONED',
  COMPLETED = 'COMPLETED',
}

export enum SubmissionStatus {
  DRAFT = 'DRAFT',
  IN_REVIEW = 'IN_REVIEW',
  SUBMITTED = 'SUBMITTED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum ProgramApplicationStatus {
  PREPARING = 'PREPARING',
  READY = 'READY',
  FILED = 'FILED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum AssessmentResult {
  PASS = 'PASS',
  FAIL = 'FAIL',
  PARTIAL = 'PARTIAL',
  NOT_EVALUATED = 'NOT_EVALUATED',
}

export enum EvidenceType {
  FACT_QUERY = 'FACT_QUERY',
  DOCUMENT = 'DOCUMENT',
  MANUAL_ENTRY = 'MANUAL_ENTRY',
}

// ──────────────────────────────────────────
// ISO Reference Codes (validated on write, never stored as enum)
// These are used for country and province/state validation.
// ──────────────────────────────────────────

/** ISO 3166-1 alpha-2 country codes relevant to StoryOS programs */
export const SUPPORTED_COUNTRIES = [
  'CA', // Canada
  'US', // United States
  'GB', // United Kingdom
  'FR', // France
  'DE', // Germany
  'AU', // Australia
  'NZ', // New Zealand
  'IE', // Ireland
] as const;
export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number];

// Canadian province ISO 3166-2 codes: canonical list in `../canadian-provinces.ts` (re-exported from package root).

/**
 * Platform-defined regional zone codes.
 * Used by program calculators for regional incentive bonus determination.
 * Extend this list as new programs with zone requirements are onboarded.
 */
export const ZONE_CODES = [
  'ON-NORTHERN',   // Northern Ontario (ONF/Ontario Creates bonus)
  'ON-EASTERN',    // Eastern Ontario
  'ON-SOUTHWESTERN', // Southwestern Ontario
  'BC-REGIONAL',   // BC Regional (outside Metro Vancouver and Capital Region)
  'QC-REGIONAL',   // Quebec Regional (outside Montreal CMA)
  'AB-REGIONAL',   // Alberta Regional
] as const;
export type ZoneCode = (typeof ZONE_CODES)[number];
