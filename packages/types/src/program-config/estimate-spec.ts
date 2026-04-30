/**
 * Declarative specification for a program's dollar estimate.
 *
 * Each spec describes: which budget lines form the eligible base,
 * what rate(s) to apply, and optional cap constraints. The
 * `runEstimate` engine consumes these specs — no per-program
 * estimator function is needed.
 *
 * IMPORTANT: These interfaces describe structured parameters, NOT
 * executable logic — consistent with RequirementConfig conventions.
 */

/** Filter that selects which EstimatorLines form the eligible base. */
export interface BaseFilter {
  /** Line type to match. Undefined = all types. */
  type?: 'Labour' | 'NonLabour';
  /**
   * Province matching rule:
   * - A specific code ('AB', 'ON', …) for exact match.
   * - 'CANADIAN' for any Canadian province.
   * - Undefined to accept any province.
   */
  provinceMatch?: string | 'CANADIAN';
  /** If true, only include post-production lines (category matches /post/i). */
  requirePost?: boolean;
  /**
   * Activity-tag filter with permissive semantics: lines that carry an
   * explicit `activity` value must match this string; lines with no
   * activity tag are included unconditionally.
   */
  activityIfTagged?: string;
}

export type BonusCondition =
  | {
      kind: 'dayShare';
      bucket: 'provincial' | 'distant';
      /** When no day data exists, fall back to this boolean key in EstimatorOpts. */
      fallbackFlag?: string;
    }
  | {
      kind: 'flag';
      /** Key in EstimatorOpts — truthy → 1, falsy → 0. */
      key: string;
    }
  | {
      kind: 'predicate';
      /** Registered predicate name (see predicates.ts in the estimators module). */
      name: string;
    };

export interface RateBonus {
  /** Additive rate component (e.g. 0.06 for a 6% regional bonus). */
  rate: number;
  /** Condition that produces a 0–1 multiplier for this bonus. */
  condition: BonusCondition;
  /** Human-readable label surfaced in trace output. */
  label: string;
}

/**
 * A named rate tier for programs with multiple base-rate levels.
 *
 * When `tiers` is present on a spec, the estimation kernel selects
 * the highest-rate tier whose `tierCode` appears as qualifying in the
 * EligibilityContext. If no EligibilityContext is provided, the kernel
 * falls back to the spec's `baseRate`.
 */
export interface RateTier {
  /** Unique tier code within the program (e.g. 'base', 'elevated'). */
  tierCode: string;
  /** The credit rate for this tier (e.g. 0.30). */
  rate: number;
  /** Human-readable label for trace output. */
  label: string;
}

/**
 * Controls how direct (non-credit) assistance is deducted from the eligible base
 * before the credit rate is applied.
 *
 * - `standard`       Labour assistance deducted in full; general assistance
 *                    pro-rated by (programBase / totalCost). Default for most programs.
 * - `proportional`   Labour assistance deducted 1:1; general assistance pro-rated
 *                    by (programBase / totalCost). Policy-defined treatment for
 *                    provincial Canadian-controlled credits (OFTTC).
 * - `totalCostProvinceFiltered`
 *                    Only deduct assistance originating from the spec's province
 *                    (via AssistanceContext.assistanceByProvince). Assistance with
 *                    unknown origin is conservatively included. Used by AB FTTC.
 * - `programSpecific` @deprecated — use `totalCostProvinceFiltered` instead.
 *                    Legacy: deducts labourAssistance only, ignoring province data.
 * - `totalCost`      Full totalAssistance deducted without pro-rating.
 *                    Used by QPE-based credits (OPSTC) where the rules doc
 *                    specifies `AdjustedQPE = GrossQPE − TotalAssistance`.
 */
export type GrindType = 'standard' | 'proportional' | 'totalCostProvinceFiltered' | 'programSpecific' | 'totalCost';

/**
 * An alternative calculation model for dual-model programs (e.g. MB-FTTC).
 *
 * When `models` is present on a spec, runEstimate evaluates each model
 * independently and selects the one producing the higher yield. The trace
 * includes all model results and the selected model code.
 */
export interface ModelVariant {
  /** Unique code identifying this model (e.g. 'labour', 'spend'). */
  code: string;
  /** Human-readable label for trace output. */
  label: string;
  /** What the eligible base represents for this model. */
  baseType: 'labour' | 'total';
  /** Filter to select which lines form the eligible base for this model. */
  baseFilter: BaseFilter;
  /** Credit rate for this model. */
  rate: number;
  /**
   * Model-specific bonuses. When present, ONLY these bonuses apply to this model.
   * When absent, the parent spec's bonuses apply. Set to `[]` to disable all bonuses.
   */
  bonuses?: RateBonus[];
  /**
   * If false, this model is not eligible (e.g. due to eligibility rules that
   * disqualify a specific model). Defaults to true. When false the model is
   * still evaluated for the trace comparison but cannot be selected as the winner.
   */
  eligible?: boolean;
}

export interface ProgramEstimateSpec {
  programCode: string;
  /** Province this program operates in. Undefined for federal programs. */
  province?: string;
  /** What the eligible base represents. */
  baseType: 'labour' | 'total';
  /** Filter to select which lines form the eligible base. */
  baseFilter: BaseFilter;
  /** Base credit rate (e.g. 0.25 for 25%). */
  baseRate: number;
  /**
   * Named rate tiers for programs with multiple base-rate levels
   * (e.g. AB FTTC 22% vs 30%). When present, runEstimate selects
   * the highest qualifying tier from EligibilityContext. Falls back
   * to `baseRate` when no EligibilityContext is provided or no tier
   * qualifies.
   */
  tiers?: RateTier[];
  /** Additive bonus rate components. */
  bonuses?: RateBonus[];
  /**
   * How direct (non-credit) assistance reduces this program's eligible base.
   * Defaults to `'standard'` when absent.
   */
  grindType?: GrindType;
  /** Optional cap on the credit amount. */
  cap?: {
    /** Cap = min(amount, percentOfBase * grossBase). */
    percentOfBase?: number;
    /** Hard dollar ceiling. */
    absolute?: number;
    /**
     * Cap = percentOfNetCost * (totalCost - totalAssistance - ledgerDeduction) * baseRate.
     * Used for CPTC and FIBC where the 60 % ceiling is applied to net eligible cost.
     * Requires AssistanceContext to be present; ignored otherwise.
     */
    percentOfNetCost?: number;
  };
  /**
   * When true, CMF licence-fee top-up amounts in the AssistanceContext are
   * reclassified as assistance before the base deduction is computed.
   * Narrow PSTC-specific exception — false / absent for every other program.
   */
  cmfTopUpIsAssistance?: boolean;
  /**
   * When true, lines flagged as `taxCreditIneligible` are excluded from the
   * eligible base. Used by programs with explicit ineligible-cost rules
   * (e.g. FIBC excludes website costs, partial craft services, application fees).
   */
  excludeIneligible?: boolean;
  /**
   * Alternative calculation models for dual-model programs (e.g. MB-FTTC).
   * When present, runEstimate evaluates each model independently using the
   * spec's deduction and bonus logic, selects the highest yield, and includes
   * a comparison trace. The selected model's baseType/baseFilter/rate override
   * the spec's top-level values.
   */
  models?: ModelVariant[];
}
