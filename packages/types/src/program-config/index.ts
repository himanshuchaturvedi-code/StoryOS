import type { ResidencyType, BudgetAccountType, DocumentCategory } from '../enums';
import type { IncentiveRegionCode } from '../incentive-regions';

export type {
  BaseFilter,
  BonusCondition,
  GrindType,
  ModelVariant,
  RateBonus,
  RateTier,
  ProgramEstimateSpec,
} from './estimate-spec';

export type {
  GrindCondition,
  GrindEdge,
  ProgramConfig,
} from './program-config';

export type {
  AssistanceAttribution,
  AssistanceContext,
  AssistanceLine,
  AssistanceOriginScope,
} from './assistance';

export type {
  EligibilityContext,
  EligibilityTier,
  EligibilityModifier,
  FailedCondition,
} from './eligibility-context';

export type {
  DocumentCondition,
  DocumentRequirement,
  FilingStage,
  FilingStageCode,
  ProgramDocumentSpec,
} from './document-spec';
export {
  DOCUMENT_REQUIREMENT_LEVELS,
  DocumentRequirementLevel,
  FILING_STAGE_CODES,
} from './document-spec';

export {
  EXPECTED_PROGRAM_REQUIREMENTS,
  getExpectedRequirementCodes,
  getExpectedRequirements,
} from './expected-requirements';
export type { ExpectedProgramRequirementManifest, ExpectedRequirement } from './expected-requirements';

/**
 * TypeScript interfaces for ProgramRequirement.configuration JSONB.
 *
 * Each RequirementCategory has a well-defined configuration shape.
 * These are validated at the API layer when seeding/creating requirements,
 * and by Phase 5 calculators at runtime.
 *
 * IMPORTANT: These interfaces describe structured parameters, NOT executable
 * logic. There is no expression parser or DSL.
 */

export interface ExpenditureThresholdConfig {
  accountTypes?: BudgetAccountType[];
  labourOnly?: boolean;
  serviceOnly?: boolean;
  minAmount?: number;
  maxAmount?: number;
  currency: string;
  /**
   * Province-ratio mode: instead of checking absolute amounts, check that
   * the province's share of total spend OR labour meets a threshold.
   * Used for FTTC elevated tier (>=60% spend in AB OR >=70% labour in AB).
   */
  provinceRatioMode?: boolean;
  /** Province to measure ratio for (e.g. 'AB'). */
  provinceMatch?: string;
  /** Minimum province share of total spend (e.g. 0.60 for 60%). */
  minSpendRatio?: number;
  /** Minimum province share of labour spend (e.g. 0.70 for 70%). */
  minLabourRatio?: number;
  /** 'either' = pass if spend OR labour ratio met; 'both' = must meet both. */
  comparisonMode?: 'either' | 'both';
}

export interface LabourExpenditureConfig {
  /**
   * How to qualify the **numerator** (which labour spend counts):
   *
   * `residency` (default): Filter by person residency type (CITIZEN, PR, etc.).
   *   Uses `numeratorResidency`.
   *
   * `location`: Filter by where services were performed (province, country).
   *   Uses `numeratorLocationFilter`. Residency is ignored.
   *   OPSTC uses this — "Ontario labour" means labour performed in Ontario,
   *   regardless of the worker's residency status.
   */
  numeratorMode?: 'residency' | 'location';
  numeratorResidency?: ResidencyType[];
  numeratorLocationFilter?: {
    country?: string;
    provinceState?: string;
    regionCodes?: IncentiveRegionCode[];
  };
  threshold: number;
  comparison: 'gte' | 'lte';
  /**
   * `labour_total` (default): qualifying labour ÷ all labour spend.
   * `qpe`: qualifying labour ÷ total eligible production spend (all lines). Used for OPSTC
   * (Ontario labour ≥ 25% of QPE; equivalent to QPE ≤ 4× Ontario labour).
   */
  denominatorMode?: 'labour_total' | 'qpe';
}

export interface KeyCreativeConfig {
  positions: Array<{ roleCode: string; points: number }>;
  minPoints: number;
  qualifyingResidency: ResidencyType[];
}

export interface CanadianControlConfig {
  minOwnershipPercentage: number;
  qualifyingCountries: string[];
  requireCreativeControl: boolean;
  requireFinancialControl: boolean;
  /**
   * When set, ownership rows must have `entityProvinceState` matching
   * this province to count toward the qualifying total. Producer credit
   * also requires `isProducer = true` with matching province.
   * Null province on a row = excluded + flagged as missingData.
   */
  requireProvinceMatch?: string;
  /** Explicit producer-credit province test (e.g. FTTC_AB_PRODUCER). */
  producerProvinceMatch?: string;
}

export interface ResidencyTestConfig {
  qualifyingResidency: ResidencyType[];
  scope: 'all_participants' | 'key_creative' | 'specific_roles';
  roleCodes?: string[];
  threshold?: number;
  comparison?: 'gte' | 'lte';
}

export interface ActivityDayMinimumConfig {
  minDays: number;
  locationFilter?: {
    country?: string;
    provinceState?: string;
    regionCodes?: IncentiveRegionCode[];
  };
  phaseFilter?: string[];
}

export interface RegionalSpendConfig {
  regionCodes: IncentiveRegionCode[];
  minDayPercentage?: number;
  minDays?: number;
  bonusRate?: number;
}

export interface FormatEligibilityConfig {
  allowedFormats: string[];
  minRuntimeMinutes?: number;
  maxRuntimeMinutes?: number;
  minEpisodes?: number;
}

export interface VendorEligibilityConfig {
  programCode: string;
  requiredStatus: string;
}

export interface RightsControlConfig {
  requiredControlTypes: string[];
  qualifyingCountries: string[];
  /** When set, rights holder must be in this province (holderProvinceState). */
  requireProvinceMatch?: string;
  /** When set, COPYRIGHT_OWNERSHIP facts must have retentionYears >= this value. */
  minRetentionYears?: number;
}

export interface DocumentationConfig {
  requiredCategories: DocumentCategory[];
  optionalCategories?: DocumentCategory[];
}

export interface ProducerCreditConfig {
  producerProvinceMatch: string;
}

export interface CustomConfig {
  [key: string]: unknown;
}

/**
 * Union of all requirement configuration types.
 * Phase 5 calculators cast configuration JSONB to the appropriate type
 * based on requirementCategory.
 */
export type RequirementConfig =
  | ExpenditureThresholdConfig
  | LabourExpenditureConfig
  | KeyCreativeConfig
  | CanadianControlConfig
  | ProducerCreditConfig
  | ResidencyTestConfig
  | ActivityDayMinimumConfig
  | RegionalSpendConfig
  | FormatEligibilityConfig
  | VendorEligibilityConfig
  | RightsControlConfig
  | DocumentationConfig
  | CustomConfig;
