/**
 * Configuration for a single incentive program's behaviour in the
 * scenario engine: evaluation tier, grinding relationships, and
 * mutual-exclusion rules.
 *
 * Complements ProgramEstimateSpec (which describes *how* to compute
 * the dollar estimate). Together they replace all per-program switch
 * statements and hardcoded arrays in the strategy service.
 */

/**
 * Condition that must be satisfied for a grind edge to apply.
 *
 * `jurisdictionOverlap`: The production must have material eligible spend in
 * ALL listed provinces. "Material" means the province's eligible base meets the
 * minimum threshold (`minBaseAmount`, default $0 = any amount). This prevents
 * trivial cross-province spend from triggering grinds.
 *
 * `always`: The edge always applies (default when condition is absent).
 */
export type GrindCondition =
  | {
      type: 'jurisdictionOverlap';
      requires: string[];
      /** Minimum eligible base amount per province to trigger. Default $0. */
      minBaseAmount?: number;
    }
  | { type: 'always' };

/** A directed grinding edge: this program's credit reduces the target's base. */
export interface GrindEdge {
  targetProgramCode: string;
  appliesTo: 'total' | 'labour' | 'nonLabour';
  /** Multiplier applied to the source's estimated amount (typically 1). */
  rate: number;
  reason: string;
  /**
   * Optional condition gating this edge. When absent the edge always applies.
   * The grind engine evaluates the condition using the scenario's spend data.
   */
  condition?: GrindCondition;
}

export interface ProgramConfig {
  programCode: string;
  /** Evaluation order tier — lower tiers evaluate first in stacking.
   *  Convention: 0 = regional, 1 = provincial, 2 = federal. */
  tier: number;
  /** Province code for provincial/regional programs; null for federal. */
  province: string | null;
  /** This program's estimated credit grinds (reduces) these targets' bases. */
  grinds: GrindEdge[];
  /** Program codes that cannot coexist in the same scenario. Must be symmetric. */
  mutuallyExclusiveWith: string[];
  /** If true, excluded from production strategy evaluation. */
  isNonProduction?: boolean;
}
