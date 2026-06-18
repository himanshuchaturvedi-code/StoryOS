import {
  DocumentCategory,
  DocumentRequirementLevel,
  FILING_STAGE_CODES,
  type FilingStageCode,
  type ProgramDocumentSpec,
} from '@storyos/types';

// ── Program document specifications ──
// Third code registry alongside PROGRAM_SPECS and PROGRAM_CONFIGS.
// Declares required/optional documents and filing stages per program.
//
// Consumed by DocumentChecklistService (Phase 2+).

const STANDARD_FILING_STAGES: ProgramDocumentSpec['filingStages'] = [
  {
    stageCode: 'PRE_APPLICATION',
    label: 'Pre-Application',
    order: 1,
    description: 'Documents assembled before submitting to the administering agency.',
  },
  {
    stageCode: 'INITIAL_CLAIM',
    label: 'Initial Claim',
    order: 2,
    description: 'First claim or advance ruling submission after production begins.',
  },
  {
    stageCode: 'FINAL_CLAIM',
    label: 'Final Claim',
    order: 3,
    description: 'Closing claim with final financials and certification documents.',
  },
  {
    stageCode: 'AUDIT',
    label: 'Audit / Review',
    order: 4,
    description: 'Post-acceptance audit or compliance review window.',
  },
];

const AMPG: ProgramDocumentSpec = {
  programCode: 'AMPG',
  agencyCode: 'AMF',
  agencyName: 'Alberta Media Fund',
  filingStages: STANDARD_FILING_STAGES,
  documents: [
    {
      documentCode: 'PRODUCTION_BUDGET',
      label: 'Production Budget',
      stageCode: 'PRE_APPLICATION',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.BUDGET,
      formats: ['PDF', 'XLSX'],
      notes: 'Detailed production budget showing Alberta and total spend.',
    },
    {
      documentCode: 'FINANCING_PLAN',
      label: 'Financing Plan',
      stageCode: 'PRE_APPLICATION',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.FINANCING,
      formats: ['PDF', 'XLSX'],
      notes: 'Sources and uses of funds; should align with StoryOS Finance Plan.',
    },
    {
      documentCode: 'CORPORATE_DOCUMENTS',
      label: 'Corporate Documents',
      stageCode: 'PRE_APPLICATION',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.CORPORATE,
      formats: ['PDF'],
      notes: 'Certificate of incorporation, articles, and corporate structure.',
    },
    {
      documentCode: 'SCRIPT_TREATMENT',
      label: 'Script / Treatment',
      stageCode: 'PRE_APPLICATION',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.SCRIPT,
      formats: ['PDF'],
    },
    {
      documentCode: 'DISTRIBUTION_PLAN',
      label: 'Distribution Plan',
      stageCode: 'PRE_APPLICATION',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.DISTRIBUTION_COMMITMENT,
      formats: ['PDF'],
      notes: 'Distribution strategy and intended release pathway.',
    },
    {
      documentCode: 'APPLICATION_PACKAGE',
      label: 'Application Package',
      stageCode: 'PRE_APPLICATION',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.OTHER,
      formats: ['PDF'],
      notes: 'Completed Alberta Media Fund application form and supporting index.',
    },
    {
      documentCode: 'PRODUCTION_SCHEDULE',
      label: 'Production Schedule',
      stageCode: 'PRE_APPLICATION',
      level: DocumentRequirementLevel.OPTIONAL,
      category: DocumentCategory.SCHEDULE,
      formats: ['PDF', 'XLSX'],
    },
    {
      documentCode: 'CHAIN_OF_TITLE',
      label: 'Chain of Title',
      stageCode: 'PRE_APPLICATION',
      level: DocumentRequirementLevel.OPTIONAL,
      category: DocumentCategory.CHAIN_OF_TITLE,
      formats: ['PDF'],
    },
    {
      documentCode: 'AB_LABOUR_SUMMARY',
      label: 'Alberta Labour Summary',
      stageCode: 'PRE_APPLICATION',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.OTHER,
      formats: ['PDF', 'XLSX'],
      notes: 'AFA Alberta Labour Summary template — Alberta resident labour breakdown.',
    },
    {
      documentCode: 'AB_SPEND_SUMMARY',
      label: 'Alberta Spend Summary',
      stageCode: 'PRE_APPLICATION',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.OTHER,
      formats: ['PDF', 'XLSX'],
      notes: 'AFA Alberta Spend Summary template — eligible Alberta expenditure breakdown.',
    },
    {
      documentCode: 'BROADCAST_AGREEMENT',
      label: 'Broadcast / Distribution Agreement',
      stageCode: 'PRE_APPLICATION',
      level: DocumentRequirementLevel.CONDITIONAL,
      category: DocumentCategory.BROADCASTER_COMMITMENT,
      formats: ['PDF'],
      condition: {
        kind: 'hasBroadcasterCommitment',
        description: 'Required when production has a broadcaster or distributor commitment.',
      },
    },
    {
      documentCode: 'INSURANCE_CERTIFICATE',
      label: 'Production Insurance Certificate',
      stageCode: 'INITIAL_CLAIM',
      level: DocumentRequirementLevel.OPTIONAL,
      category: DocumentCategory.INSURANCE,
      formats: ['PDF'],
    },
    {
      documentCode: 'AUDITED_COST_REPORT',
      label: 'Audited Cost Report',
      stageCode: 'FINAL_CLAIM',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.OTHER,
      formats: ['PDF'],
      notes: 'CPA-signed final cost report for grant reconciliation.',
    },
    {
      documentCode: 'COMPLETION_CERTIFICATE',
      label: 'Completion Certificate',
      stageCode: 'FINAL_CLAIM',
      level: DocumentRequirementLevel.OPTIONAL,
      category: DocumentCategory.COMPLETION_CERTIFICATE,
      formats: ['PDF'],
    },
  ],
};

const CPTC: ProgramDocumentSpec = {
  programCode: 'CPTC',
  agencyCode: 'CAVCO',
  agencyName: 'Canadian Audio-Visual Certification Office',
  filingStages: STANDARD_FILING_STAGES,
  documents: [
    {
      documentCode: 'PRODUCTION_BUDGET',
      label: 'Production Budget',
      stageCode: 'PRE_APPLICATION',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.BUDGET,
      formats: ['PDF', 'XLSX'],
      notes: 'Detailed production budget; basis for CAVCO Part A labour calculations.',
    },
    {
      documentCode: 'FINANCING_PLAN',
      label: 'Financing Plan',
      stageCode: 'PRE_APPLICATION',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.FINANCING,
      formats: ['PDF', 'XLSX'],
    },
    {
      documentCode: 'SCRIPT',
      label: 'Script or Synopsis',
      stageCode: 'PRE_APPLICATION',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.SCRIPT,
      formats: ['PDF'],
    },
    {
      documentCode: 'PRODUCTION_SCHEDULE',
      label: 'Production Schedule',
      stageCode: 'PRE_APPLICATION',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.SCHEDULE,
      formats: ['PDF', 'XLSX'],
    },
    {
      documentCode: 'CORPORATE_STRUCTURE',
      label: 'Corporate Structure Chart',
      stageCode: 'PRE_APPLICATION',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.CORPORATE,
      formats: ['PDF'],
      notes: 'Ownership and control structure for Canadian control test.',
    },
    {
      documentCode: 'CHAIN_OF_TITLE',
      label: 'Chain of Title',
      stageCode: 'PRE_APPLICATION',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.CHAIN_OF_TITLE,
      formats: ['PDF'],
    },
    {
      documentCode: 'KEY_CREATIVE_DOCUMENTATION',
      label: 'Key Creative Personnel Documentation',
      stageCode: 'PRE_APPLICATION',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.OTHER,
      formats: ['PDF'],
      notes: 'Residency and role evidence for CAVCO key creative points test.',
    },
    {
      documentCode: 'BROADCASTER_AGREEMENT',
      label: 'Broadcast License Agreement',
      stageCode: 'PRE_APPLICATION',
      level: DocumentRequirementLevel.CONDITIONAL,
      category: DocumentCategory.BROADCASTER_COMMITMENT,
      formats: ['PDF'],
      condition: {
        kind: 'hasBroadcasterCommitment',
        description: 'Required for productions with a Canadian broadcaster license agreement.',
      },
    },
    {
      documentCode: 'DISTRIBUTION_AGREEMENT',
      label: 'Distribution Agreement',
      stageCode: 'PRE_APPLICATION',
      level: DocumentRequirementLevel.OPTIONAL,
      category: DocumentCategory.DISTRIBUTION_COMMITMENT,
      formats: ['PDF'],
    },
    {
      documentCode: 'CAVCO_PART_A',
      label: 'CAVCO Part A (Certificate of Compliance)',
      stageCode: 'INITIAL_CLAIM',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.CAVCO_PART_A,
      formats: ['PDF'],
      notes: 'Advance ruling application; StoryOS can generate from budget data.',
    },
    {
      documentCode: 'ELIGIBILITY_CERTIFICATE',
      label: 'Eligibility Certificate',
      stageCode: 'INITIAL_CLAIM',
      level: DocumentRequirementLevel.OPTIONAL,
      category: DocumentCategory.ELIGIBILITY_CERTIFICATE,
      formats: ['PDF'],
      notes: 'Issued by CAVCO after Part A approval; required before final claim.',
    },
    {
      documentCode: 'CAVCO_PART_B',
      label: 'CAVCO Part B (Final Certification)',
      stageCode: 'FINAL_CLAIM',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.CAVCO_PART_B,
      formats: ['PDF'],
    },
    {
      documentCode: 'ELIGIBILITY_CERTIFICATE_FINAL',
      label: 'Eligibility Certificate (Final)',
      stageCode: 'FINAL_CLAIM',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.ELIGIBILITY_CERTIFICATE,
      notes: 'Final eligibility certificate issued by CAVCO.',
    },
    {
      documentCode: 'TAX_CLAIM_FORM',
      label: 'T2 Schedule Tax Claim',
      stageCode: 'FINAL_CLAIM',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.TAX_CLAIM_FORM,
      formats: ['PDF'],
      notes: 'CRA T2 corporate tax claim schedule for CPTC.',
    },
    {
      documentCode: 'COMPLETION_CERTIFICATE',
      label: 'Completion Certificate',
      stageCode: 'FINAL_CLAIM',
      level: DocumentRequirementLevel.REQUIRED,
      category: DocumentCategory.COMPLETION_CERTIFICATE,
      formats: ['PDF'],
    },
    {
      documentCode: 'CONTRACT_EVIDENCE',
      label: 'Talent & Service Contracts',
      stageCode: 'FINAL_CLAIM',
      level: DocumentRequirementLevel.OPTIONAL,
      category: DocumentCategory.CONTRACT,
      formats: ['PDF'],
      notes: 'Supporting contracts for labour and service expenditure verification.',
    },
  ],
};

const ALL_DOCUMENT_SPECS: ProgramDocumentSpec[] = [AMPG, CPTC];

export const PROGRAM_DOCUMENT_SPECS: ReadonlyMap<string, ProgramDocumentSpec> = new Map(
  ALL_DOCUMENT_SPECS.map((spec) => [spec.programCode, spec]),
);

// ── Validator ──

const VALID_LEVELS = new Set<string>(Object.values(DocumentRequirementLevel));
const VALID_STAGE_CODES = new Set<string>(FILING_STAGE_CODES);
const VALID_CATEGORIES = new Set<string>(Object.values(DocumentCategory));

export function validateProgramDocumentSpecs(): string[] {
  const errors: string[] = [];

  for (const spec of PROGRAM_DOCUMENT_SPECS.values()) {
    const prefix = spec.programCode;

    const stageCodes = new Set<string>();
    for (const stage of spec.filingStages) {
      if (!VALID_STAGE_CODES.has(stage.stageCode)) {
        errors.push(`${prefix}: invalid filing stage code "${stage.stageCode}"`);
      }
      if (stageCodes.has(stage.stageCode)) {
        errors.push(`${prefix}: duplicate filing stage code "${stage.stageCode}"`);
      }
      stageCodes.add(stage.stageCode);
    }

    const documentCodes = new Set<string>();
    for (const doc of spec.documents) {
      if (documentCodes.has(doc.documentCode)) {
        errors.push(`${prefix}: duplicate document code "${doc.documentCode}"`);
      }
      documentCodes.add(doc.documentCode);

      if (!VALID_LEVELS.has(doc.level)) {
        errors.push(`${prefix}: invalid requirement level "${doc.level}" on ${doc.documentCode}`);
      }

      if (!VALID_STAGE_CODES.has(doc.stageCode)) {
        errors.push(`${prefix}: invalid stage reference "${doc.stageCode}" on ${doc.documentCode}`);
      } else if (!stageCodes.has(doc.stageCode)) {
        errors.push(
          `${prefix}: document ${doc.documentCode} references undeclared stage "${doc.stageCode}"`,
        );
      }

      if (doc.category && !VALID_CATEGORIES.has(doc.category)) {
        errors.push(`${prefix}: invalid DocumentCategory "${doc.category}" on ${doc.documentCode}`);
      }

      if (doc.level === DocumentRequirementLevel.CONDITIONAL && !doc.condition) {
        errors.push(`${prefix}: CONDITIONAL document ${doc.documentCode} missing condition`);
      }
    }
  }

  return errors;
}

/** Returns filing stages for a program in display order. */
export function getFilingStages(programCode: string): readonly FilingStageCode[] {
  const spec = PROGRAM_DOCUMENT_SPECS.get(programCode);
  if (!spec) return [];
  return [...spec.filingStages]
    .sort((a, b) => a.order - b.order)
    .map((s) => s.stageCode);
}

const _validationErrors = validateProgramDocumentSpecs();
if (_validationErrors.length > 0) {
  throw new Error(
    `PROGRAM_DOCUMENT_SPECS validation failed:\n${_validationErrors.map((e) => `  - ${e}`).join('\n')}`,
  );
}
