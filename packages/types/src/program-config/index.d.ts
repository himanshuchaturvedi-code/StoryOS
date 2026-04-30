import type { ResidencyType, BudgetAccountType, DocumentCategory } from '../enums';
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
}
export interface LabourExpenditureConfig {
    numeratorResidency: ResidencyType[];
    threshold: number;
    comparison: 'gte' | 'lte';
}
export interface KeyCreativeConfig {
    positions: Array<{
        roleCode: string;
        points: number;
    }>;
    minPoints: number;
    qualifyingResidency: ResidencyType[];
}
export interface CanadianControlConfig {
    minOwnershipPercentage: number;
    qualifyingCountries: string[];
    requireCreativeControl: boolean;
    requireFinancialControl: boolean;
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
        zoneCodes?: string[];
    };
    phaseFilter?: string[];
}
export interface RegionalSpendConfig {
    zoneCodes: string[];
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
}
export interface DocumentationConfig {
    requiredCategories: DocumentCategory[];
    optionalCategories?: DocumentCategory[];
}
export interface CustomConfig {
    [key: string]: unknown;
}
/**
 * Union of all requirement configuration types.
 * Phase 5 calculators cast configuration JSONB to the appropriate type
 * based on requirementCategory.
 */
export type RequirementConfig = ExpenditureThresholdConfig | LabourExpenditureConfig | KeyCreativeConfig | CanadianControlConfig | ResidencyTestConfig | ActivityDayMinimumConfig | RegionalSpendConfig | FormatEligibilityConfig | VendorEligibilityConfig | RightsControlConfig | DocumentationConfig | CustomConfig;
//# sourceMappingURL=index.d.ts.map