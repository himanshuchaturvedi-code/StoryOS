/** Programs with registry-backed document checklists. */
export const DOCUMENT_CHECKLIST_PROGRAM_CODES = ['AMPG', 'CPTC'] as const;

export type DocumentChecklistProgramCode =
  (typeof DOCUMENT_CHECKLIST_PROGRAM_CODES)[number];

export interface ChecklistProgramRef {
  programCode: string;
  programName: string;
}

interface StrategyProgramLike {
  programCode?: string;
  programName?: string;
}

export interface IncentiveStrategyChecklistSource {
  allPrograms?: StrategyProgramLike[];
  scenarios?: Array<{ programs?: StrategyProgramLike[]; isRecommended?: boolean }>;
  recommendedScenarioId?: string | null;
}

/**
 * Collect AMPG/CPTC from anywhere in the incentive strategy response.
 * Scenarios (recommended stack included) are scanned in addition to allPrograms.
 */
export function extractChecklistProgramsFromStrategy(
  data: IncentiveStrategyChecklistSource | null | undefined,
): ChecklistProgramRef[] {
  if (!data) return [];

  const byCode = new Map<DocumentChecklistProgramCode, string>();

  function absorb(programs: StrategyProgramLike[] | undefined) {
    for (const program of programs ?? []) {
      const code = program.programCode;
      if (!code) continue;
      if (!(DOCUMENT_CHECKLIST_PROGRAM_CODES as readonly string[]).includes(code)) {
        continue;
      }
      const checklistCode = code as DocumentChecklistProgramCode;
      if (!byCode.has(checklistCode)) {
        byCode.set(checklistCode, program.programName?.trim() || code);
      }
    }
  }

  absorb(data.allPrograms);

  for (const scenario of data.scenarios ?? []) {
    absorb(scenario.programs);
  }

  return DOCUMENT_CHECKLIST_PROGRAM_CODES.filter((code) => byCode.has(code)).map(
    (code) => ({
      programCode: code,
      programName: byCode.get(code)!,
    }),
  );
}
