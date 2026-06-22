/**
 * CPTC Breakdown of Costs (01F21) line mapping registry types.
 * Used by document generation mapping (future slices) — not consumed by mapper in Slice 4B.
 */

export const BOC_COLUMN_KEYS = [
  'keyCreativeCanadian',
  'keyCreativeNonCanadian',
  'servicesCanadian',
  'servicesNonCanadian',
  'postProductionLabCanadian',
  'postProductionLabNonCanadian',
  'otherCosts',
] as const;

export type BocColumnKey = (typeof BOC_COLUMN_KEYS)[number];

export type BocSummaryFormulaType =
  | 'SUM_LINE_TOTALS'
  | 'SUM_KEY_CREATIVE_COLUMNS'
  | 'SUM_POST_LAB_COLUMNS'
  | 'RATIO_KEY_CREATIVE_CANADIAN'
  | 'RATIO_POST_LAB_CANADIAN';

export interface BocRegistryMeta {
  programCode: string;
  formCode: string;
  formLabel: string;
  formVersion: string;
  registryVersion: string;
  templateVersion: string;
}

export interface BocLineSourceRule {
  templateId: string;
  /** Exact Telefilm account codes (e.g. "02.01"). */
  accounts?: string[];
  /** Glob patterns using * wildcard (e.g. "23.*"). */
  patterns?: string[];
  /** Accounts rolled into this line (e.g. fringe benefits). */
  rollups?: string[];
  /** Excluded from pattern matches. */
  excludeAccounts?: string[];
  /** When true, this account may map to multiple form lines. */
  allowShared?: boolean;
}

export interface BocFormLineDefinition {
  code: string;
  label: string;
  parentCode?: string;
  isHeader?: boolean;
  /** When true, value columns must remain empty on the official form (e.g. 10.1). */
  forceEmpty?: boolean;
  allowedColumns: BocColumnKey[];
  sources?: BocLineSourceRule[];
}

export interface BocSummaryLineDefinition {
  code: string;
  label: string;
  formula: BocSummaryFormulaType;
  /** Inclusive form line code range for SUM_LINE_TOTALS. */
  sourceLineRange?: [string, string];
}

export interface BocTemplateDefinition {
  sourceFile: string;
  sheetName?: string;
  /** Leaf accounts matching these patterns are excluded from coverage denominator. */
  coverageExcludePatterns?: string[];
  unmappedAccountPolicy?: 'WARN' | 'ERROR';
}

export interface BocFormRegistry {
  meta: BocRegistryMeta;
  lines: BocFormLineDefinition[];
  summaryLines: BocSummaryLineDefinition[];
  templates: Record<string, BocTemplateDefinition>;
}

export interface BocRegistryValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface BocRegistryValidationResult {
  valid: boolean;
  errors: BocRegistryValidationIssue[];
  warnings: BocRegistryValidationIssue[];
}

export interface BocUnmappedSectionSummary {
  section: string;
  sectionLabel?: string;
  unmappedCount: number;
  unmappedAccounts: string[];
}

export interface BocRegistryCoverageReport {
  templateId: string;
  templateVersion: string;
  totalAccounts: number;
  totalLeafAccounts: number;
  coverageEligibleAccounts: number;
  mappedAccounts: number;
  unmappedAccounts: number;
  coveragePercentage: number;
  excludedFromCoverage: number;
  topUnmappedSections: BocUnmappedSectionSummary[];
  unmappedAccountCodes: string[];
}
