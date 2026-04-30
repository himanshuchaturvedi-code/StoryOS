/**
 * Expected requirement manifest for program configuration validation.
 *
 * Each entry declares:
 *   - code: the RequirementCode that must exist on the ProgramVersion
 *   - category: the expected RequirementCategory (validated against DB)
 *   - configKeys: key config fields that must be present (shallow check)
 *
 * The manifest is used by ProgramConfigValidationService at startup
 * and by the validate-program-config CLI script.
 */

export interface ExpectedRequirement {
  code: string;
  category: string;
  configKeys?: string[];
}

export type ExpectedProgramRequirementManifest = Record<string, readonly ExpectedRequirement[]>;

export const EXPECTED_PROGRAM_REQUIREMENTS: ExpectedProgramRequirementManifest = {
  'DEV-PROGRAM': [
    { code: 'MIN_SPEND', category: 'EXPENDITURE_THRESHOLD', configKeys: ['currency'] },
  ],
  CPTC: [
    { code: 'CPTC_EXPENDITURE', category: 'EXPENDITURE_THRESHOLD', configKeys: ['currency'] },
    { code: 'CPTC_LABOUR_RATIO', category: 'LABOUR_EXPENDITURE', configKeys: ['threshold'] },
    { code: 'CPTC_KEY_CREATIVE', category: 'KEY_CREATIVE_TEST', configKeys: ['minPoints'] },
    { code: 'CPTC_CANADIAN_CONTROL', category: 'CANADIAN_CONTROL', configKeys: ['minOwnershipPercentage'] },
    { code: 'CPTC_RIGHTS', category: 'RIGHTS_CONTROL', configKeys: ['requiredControlTypes'] },
    { code: 'CPTC_FORMAT', category: 'FORMAT_ELIGIBILITY', configKeys: ['allowedFormats'] },
  ],
  PSTC: [
    { code: 'PSTC_EXPENDITURE', category: 'EXPENDITURE_THRESHOLD', configKeys: ['currency'] },
    { code: 'PSTC_LABOUR', category: 'LABOUR_EXPENDITURE', configKeys: ['threshold'] },
    { code: 'PSTC_RESIDENCY', category: 'RESIDENCY_TEST', configKeys: ['qualifyingResidency'] },
    { code: 'PSTC_FORMAT', category: 'FORMAT_ELIGIBILITY', configKeys: ['allowedFormats'] },
  ],
  OFTTC: [
    { code: 'OFTTC_EXPENDITURE', category: 'EXPENDITURE_THRESHOLD', configKeys: ['currency'] },
    { code: 'OFTTC_LABOUR', category: 'LABOUR_EXPENDITURE', configKeys: ['threshold'] },
    { code: 'OFTTC_REGIONAL', category: 'REGIONAL_SPEND', configKeys: ['regionCodes'] },
    { code: 'OFTTC_DISTANT', category: 'REGIONAL_SPEND', configKeys: ['regionCodes'] },
    { code: 'OFTTC_KEY_CREATIVE', category: 'KEY_CREATIVE_TEST', configKeys: ['minPoints'] },
    { code: 'OFTTC_CANADIAN_CONTROL', category: 'CANADIAN_CONTROL', configKeys: ['minOwnershipPercentage'] },
    { code: 'OFTTC_FORMAT', category: 'FORMAT_ELIGIBILITY', configKeys: ['allowedFormats'] },
  ],
  OPSTC: [
    { code: 'OPSTC_EXPENDITURE', category: 'EXPENDITURE_THRESHOLD', configKeys: ['currency'] },
    { code: 'OPSTC_ONTARIO_LABOUR_QPE', category: 'LABOUR_EXPENDITURE', configKeys: ['threshold'] },
    { code: 'OPSTC_RESIDENCY', category: 'RESIDENCY_TEST', configKeys: ['qualifyingResidency'] },
    { code: 'OPSTC_FORMAT', category: 'FORMAT_ELIGIBILITY', configKeys: ['allowedFormats'] },
  ],
  OCASE: [
    { code: 'OCASE_EXPENDITURE', category: 'EXPENDITURE_THRESHOLD', configKeys: ['currency'] },
    { code: 'OCASE_LABOUR', category: 'LABOUR_EXPENDITURE', configKeys: ['threshold'] },
    { code: 'OCASE_DOCUMENTATION', category: 'DOCUMENTATION', configKeys: ['requiredCategories'] },
    { code: 'OCASE_CANADIAN_CONTROL', category: 'CANADIAN_CONTROL', configKeys: ['minOwnershipPercentage'] },
    { code: 'OCASE_FORMAT', category: 'FORMAT_ELIGIBILITY', configKeys: ['allowedFormats'] },
  ],
  FIBC: [
    { code: 'FIBC_EXPENDITURE', category: 'EXPENDITURE_THRESHOLD', configKeys: ['currency'] },
    { code: 'FIBC_LABOUR', category: 'LABOUR_EXPENDITURE', configKeys: ['threshold'] },
    { code: 'FIBC_REGIONAL', category: 'REGIONAL_SPEND', configKeys: ['regionCodes'] },
    { code: 'FIBC_DISTANT', category: 'REGIONAL_SPEND', configKeys: ['regionCodes'] },
    { code: 'FIBC_ACTIVITY_DAYS', category: 'ACTIVITY_DAY_MINIMUM', configKeys: ['minDays'] },
    { code: 'FIBC_CANADIAN_CONTROL', category: 'CANADIAN_CONTROL', configKeys: ['minOwnershipPercentage'] },
    { code: 'FIBC_FORMAT', category: 'FORMAT_ELIGIBILITY', configKeys: ['allowedFormats'] },
    { code: 'FIBC_VENDOR', category: 'VENDOR_ELIGIBILITY', configKeys: ['programCode'] },
  ],
  'BC-PSTC': [
    { code: 'BCPSTC_EXPENDITURE', category: 'EXPENDITURE_THRESHOLD', configKeys: ['currency'] },
    { code: 'BCPSTC_LABOUR', category: 'LABOUR_EXPENDITURE', configKeys: ['threshold'] },
    { code: 'BCPSTC_RESIDENCY', category: 'RESIDENCY_TEST', configKeys: ['qualifyingResidency'] },
    { code: 'BCPSTC_REGIONAL', category: 'REGIONAL_SPEND', configKeys: ['regionCodes'] },
    { code: 'BCPSTC_FORMAT', category: 'FORMAT_ELIGIBILITY', configKeys: ['allowedFormats'] },
  ],
  CMF: [
    { code: 'CMF_EXPENDITURE', category: 'EXPENDITURE_THRESHOLD', configKeys: ['currency'] },
    { code: 'CMF_CANADIAN_CONTROL', category: 'CANADIAN_CONTROL', configKeys: ['minOwnershipPercentage'] },
    { code: 'CMF_KEY_CREATIVE', category: 'KEY_CREATIVE_TEST', configKeys: ['minPoints'] },
    { code: 'CMF_DOCUMENTATION', category: 'DOCUMENTATION', configKeys: ['requiredCategories'] },
    { code: 'CMF_FORMAT', category: 'FORMAT_ELIGIBILITY', configKeys: ['allowedFormats'] },
  ],
  FTTC: [
    { code: 'FTTC_EXPENDITURE', category: 'EXPENDITURE_THRESHOLD', configKeys: ['currency', 'minAmount'] },
    { code: 'FTTC_ALBERTA_LABOUR', category: 'LABOUR_EXPENDITURE', configKeys: ['threshold', 'numeratorMode'] },
    { code: 'FTTC_RESIDENCY', category: 'RESIDENCY_TEST', configKeys: ['qualifyingResidency'] },
    { code: 'FTTC_FORMAT', category: 'FORMAT_ELIGIBILITY', configKeys: ['allowedFormats'] },
    { code: 'FTTC_AB_OWNERSHIP', category: 'CANADIAN_CONTROL', configKeys: ['minOwnershipPercentage', 'requireProvinceMatch'] },
    { code: 'FTTC_AB_PRODUCER', category: 'PRODUCER_CREDIT', configKeys: ['producerProvinceMatch'] },
    { code: 'FTTC_AB_COPYRIGHT', category: 'RIGHTS_CONTROL', configKeys: ['requiredControlTypes', 'minRetentionYears'] },
    { code: 'FTTC_AB_SPEND_RATIO', category: 'EXPENDITURE_THRESHOLD', configKeys: ['provinceRatioMode', 'minSpendRatio'] },
    { code: 'FTTC_RURAL', category: 'REGIONAL_SPEND', configKeys: ['regionCodes', 'minDayPercentage'] },
  ],
  AMPG: [
    { code: 'AMPG_MIN_SPEND', category: 'EXPENDITURE_THRESHOLD', configKeys: ['currency'] },
    { code: 'AMPG_MAX_BUDGET', category: 'EXPENDITURE_THRESHOLD', configKeys: ['currency'] },
    { code: 'AMPG_ALBERTA_LABOUR', category: 'LABOUR_EXPENDITURE', configKeys: ['threshold'] },
    { code: 'AMPG_FORMAT', category: 'FORMAT_ELIGIBILITY', configKeys: ['allowedFormats'] },
  ],
  'MB-FTTC': [
    { code: 'MB_FTTC_EXPENDITURE', category: 'EXPENDITURE_THRESHOLD', configKeys: ['currency'] },
    { code: 'MB_FTTC_LABOUR', category: 'LABOUR_EXPENDITURE', configKeys: ['threshold'] },
    { code: 'MB_FTTC_CANADIAN_CONTROL', category: 'CANADIAN_CONTROL', configKeys: ['minOwnershipPercentage'] },
    { code: 'MB_FTTC_FORMAT', category: 'FORMAT_ELIGIBILITY', configKeys: ['allowedFormats'] },
    { code: 'MB_FTTC_RURAL', category: 'REGIONAL_SPEND', configKeys: ['regionCodes'] },
    { code: 'MB_FTTC_NORTHERN', category: 'REGIONAL_SPEND', configKeys: ['regionCodes'] },
    { code: 'MB_FTTC_OWNERSHIP', category: 'CANADIAN_CONTROL', configKeys: ['minOwnershipPercentage'] },
  ],
};

/**
 * Returns the expected requirement codes for a program.
 * Used when only code-level checks are needed (e.g. quick CLI validation).
 */
export function getExpectedRequirementCodes(programCode: string): readonly string[] | undefined {
  const entries = EXPECTED_PROGRAM_REQUIREMENTS[programCode];
  return entries?.map((e) => e.code);
}

/**
 * Returns the full expected requirement entries (code + category + configKeys)
 * for a program. Used by ProgramConfigValidationService for integrity checks.
 */
export function getExpectedRequirements(programCode: string): readonly ExpectedRequirement[] | undefined {
  return EXPECTED_PROGRAM_REQUIREMENTS[programCode];
}
