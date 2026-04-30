/**
 * Lightweight funding-source classification for incentive calculations.
 *
 * Projects onto the FinanceSource model's persisted fields:
 * `attributionType` ('labour' | 'general') and `originProvince`.
 */

export type AssistanceAttribution = 'labour' | 'general';

/**
 * Jurisdiction scope of an assistance source.
 * - `federal`: Source is a federal program (e.g. CMF, Telefilm).
 *   Federal assistance is always deducted regardless of province filter.
 * - `provincial`: Source originates from a specific province (see `originProvince`).
 *   Province-filtered grinds only deduct provincial assistance matching the spec's province.
 * - `unknown`: Origin jurisdiction is not recorded. Flagged as missingData.
 */
export type AssistanceOriginScope = 'federal' | 'provincial' | 'unknown';

export interface AssistanceLine {
  /** Source type from FinanceSourceType, kept as a string to avoid a DB package dependency. */
  sourceType: string;
  /** Human-readable source name, e.g. "NOHFC Grant" or "CMF Top-Up". */
  name: string;
  /** Dollar amount in CAD. */
  amount: number;
  /** True when this source reduces one or more incentive cost bases. */
  isAssistance: boolean;
  /** Whether assistance is labour-specific or applies generally to production costs. */
  attribution: AssistanceAttribution;
  /** True when attributionType was null in the DB — the attribution is assumed, not known. */
  attributionMissing: boolean;
  /** Jurisdiction scope: federal, provincial, or unknown. */
  originScope: AssistanceOriginScope;
  /** 2-letter province code identifying the origin jurisdiction of this funding. */
  originProvince?: string;
}

export interface AssistanceContext {
  /** Gross production cost used for proportional assistance calculations. */
  totalCost: number;
  /** Classified funding sources for the project. */
  lines: AssistanceLine[];
  /** Sum of all lines where isAssistance=true. */
  totalAssistance: number;
  /** Sum of assistance lines attributed directly to labour. */
  labourAssistance: number;
  /** Sum of assistance lines attributed to general production costs. */
  generalAssistance: number;
  /**
   * Assistance totals grouped by origin province code.
   * Sources with null originProvince are bucketed under 'UNKNOWN'.
   * Used by province-filtered grinds (e.g. AB FTTC ignores out-of-province assistance).
   */
  assistanceByProvince: Record<string, number>;
  /** Total assistance from federal sources (always deducted in province-filtered grinds). */
  federalAssistance: number;
  /** Total assistance from sources with unknown origin (flagged as missingData). */
  unknownOriginAssistance: number;
  /**
   * Sum of budget lines flagged as tax-credit-ineligible.
   * Subtracted from the net-cost denominator in percentOfNetCost caps (e.g. FIBC 60% rule).
   */
  ineligibleCostDeduction: number;
  /**
   * Data quality warnings surfaced in the trace/UI.
   * Each entry names a specific gap (e.g. 'attributionType missing on 3 assistance sources').
   */
  dataGaps: string[];
}
