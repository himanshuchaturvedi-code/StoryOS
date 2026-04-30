/**
 * Structured output from the eligibility evaluation layer.
 *
 * Built by the strategy service from existing calculator results,
 * then passed into the estimation kernel so rate/tier selection
 * is deterministic and driven by proven eligibility — not heuristics.
 */

/**
 * A named rate tier that the project qualifies (or fails to qualify) for.
 * The estimation kernel selects the highest-rate qualifying tier.
 */
export interface EligibilityTier {
  /** Unique tier code within a program, e.g. 'base', 'elevated', 'rural'. */
  tierCode: string;
  /** The credit rate this tier awards (e.g. 0.30 for 30%). */
  rate: number;
  /** True when all prerequisite conditions for this tier have been met. */
  qualifies: boolean;
  /** Human-readable explanation of why the tier does or does not apply. */
  reasoning: string;
  /** Structured breakdown of tier qualification decisions, e.g. for FTTC elevated tier. */
  elevatedTierDecision?: {
    qualifies: boolean;
    requirements: Record<string, {
      name: string;
      result: 'PASS' | 'FAIL' | 'PARTIAL' | 'NOT_EVALUATED';
    }>;
  };
}

/**
 * A regional or conditional modifier that the project may qualify for.
 * Unlike tiers (which select a base rate), modifiers are additive
 * rate components that scale by a 0–1 condition value.
 */
export interface EligibilityModifier {
  /** Modifier code matching a RateBonus label, e.g. 'regional', 'distant'. */
  modifierCode: string;
  /** True when the eligibility layer confirms this modifier applies. */
  qualifies: boolean;
  /** Human-readable explanation. */
  reasoning: string;
}

/**
 * A condition that was evaluated and failed.
 */
export interface FailedCondition {
  /** The requirement code that failed (e.g. 'FTTC_EXPENDITURE'). */
  requirementCode: string;
  /** Human-readable requirement name. */
  requirementName: string;
  /** Why it failed. */
  reason: string;
}

/**
 * Eligibility context for a single program, consumed by runEstimate.
 *
 * When absent, the estimation kernel falls back to the legacy
 * bonus/predicate path for backward compatibility.
 */
export interface EligibilityContext {
  /** Overall program eligibility. */
  isEligible: boolean;
  /** Qualifying and non-qualifying tiers, ordered by rate descending. */
  tiers: EligibilityTier[];
  /** Conditions that were evaluated and failed. */
  failedConditions: FailedCondition[];
  /** Regional/conditional modifiers with their eligibility status. */
  modifiers: EligibilityModifier[];
}
