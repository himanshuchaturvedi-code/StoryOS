/** Programs with registry-backed document checklists (matches API PROGRAM_DOCUMENT_SPECS). */
export const TAGGABLE_PROGRAM_CODES = ['AMPG', 'CPTC'] as const;

export type TaggableProgramCode = (typeof TAGGABLE_PROGRAM_CODES)[number];

export interface ProgramDocumentRequirementOption {
  documentCode: string;
  label: string;
}

export interface TaggableProgramOption {
  programCode: TaggableProgramCode;
  programName: string;
  requirements: ProgramDocumentRequirementOption[];
}

/** Pilot catalog for upload/tag UI — keep in sync with apps/api program-document-specs.ts labels. */
export const TAGGABLE_PROGRAMS: TaggableProgramOption[] = [
  {
    programCode: 'AMPG',
    programName: 'Alberta Made Production Grant',
    requirements: [
      { documentCode: 'PRODUCTION_BUDGET', label: 'Production Budget' },
      { documentCode: 'FINANCING_PLAN', label: 'Financing Plan' },
      { documentCode: 'CORPORATE_DOCUMENTS', label: 'Corporate Documents' },
      { documentCode: 'SCRIPT_TREATMENT', label: 'Script / Treatment' },
      { documentCode: 'DISTRIBUTION_PLAN', label: 'Distribution Plan' },
      { documentCode: 'APPLICATION_PACKAGE', label: 'Application Package' },
      { documentCode: 'PRODUCTION_SCHEDULE', label: 'Production Schedule' },
      { documentCode: 'CHAIN_OF_TITLE', label: 'Chain of Title' },
      { documentCode: 'AB_LABOUR_SUMMARY', label: 'Alberta Labour Summary' },
      { documentCode: 'AB_SPEND_SUMMARY', label: 'Alberta Spend Summary' },
      { documentCode: 'BROADCAST_AGREEMENT', label: 'Broadcast / Distribution Agreement' },
      { documentCode: 'INSURANCE_CERTIFICATE', label: 'Production Insurance Certificate' },
      { documentCode: 'AUDITED_COST_REPORT', label: 'Audited Cost Report' },
      { documentCode: 'COMPLETION_CERTIFICATE', label: 'Completion Certificate' },
    ],
  },
  {
    programCode: 'CPTC',
    programName: 'Canadian Film or Video Production Tax Credit',
    requirements: [
      { documentCode: 'PRODUCTION_BUDGET', label: 'Production Budget' },
      { documentCode: 'FINANCING_PLAN', label: 'Financing Plan' },
      { documentCode: 'SCRIPT', label: 'Script or Synopsis' },
      { documentCode: 'PRODUCTION_SCHEDULE', label: 'Production Schedule' },
      { documentCode: 'CORPORATE_STRUCTURE', label: 'Corporate Structure Chart' },
      { documentCode: 'CHAIN_OF_TITLE', label: 'Chain of Title' },
      { documentCode: 'KEY_CREATIVE_DOCUMENTATION', label: 'Key Creative Personnel Documentation' },
      { documentCode: 'BROADCASTER_AGREEMENT', label: 'Broadcast License Agreement' },
      { documentCode: 'DISTRIBUTION_AGREEMENT', label: 'Distribution Agreement' },
      { documentCode: 'CAVCO_PART_A', label: 'CAVCO Part A (Certificate of Compliance)' },
      { documentCode: 'ELIGIBILITY_CERTIFICATE', label: 'Eligibility Certificate' },
      { documentCode: 'CAVCO_PART_B', label: 'CAVCO Part B (Final Certification)' },
      { documentCode: 'ELIGIBILITY_CERTIFICATE_FINAL', label: 'Eligibility Certificate (Final)' },
      { documentCode: 'TAX_CLAIM_FORM', label: 'T2 Schedule Tax Claim' },
      { documentCode: 'COMPLETION_CERTIFICATE', label: 'Completion Certificate' },
      { documentCode: 'CONTRACT_EVIDENCE', label: 'Talent & Service Contracts' },
    ],
  },
];

const programByCode = new Map(TAGGABLE_PROGRAMS.map((program) => [program.programCode, program]));

export function getTaggableProgram(programCode: string | null | undefined) {
  if (!programCode) return undefined;
  return programByCode.get(programCode as TaggableProgramCode);
}

export function getRequirementLabel(
  programCode: string | null | undefined,
  documentCode: string | null | undefined,
): string | null {
  if (!programCode || !documentCode) return null;
  const program = getTaggableProgram(programCode);
  return program?.requirements.find((req) => req.documentCode === documentCode)?.label ?? documentCode;
}

export function formatDocumentTagDisplay(
  programCode: string | null | undefined,
  programDocumentCode: string | null | undefined,
): string | null {
  if (!programCode || !programDocumentCode) return null;
  const label = getRequirementLabel(programCode, programDocumentCode);
  return `${programCode} / ${label ?? programDocumentCode}`;
}
