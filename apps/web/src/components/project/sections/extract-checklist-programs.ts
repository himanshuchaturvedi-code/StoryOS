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
  scenarios?: Array<{
    programs?: StrategyProgramLike[];
    isRecommended?: boolean;
    title?: string;
  }>;
  recommendedScenarioId?: string | null;
}

/** Same program-code arrays rendered as gray badges on strategy scenario cards. */
export interface VisibleStrategyBadgeSource {
  recommendedPrograms?: StrategyProgramLike[];
  otherScenarioPrograms?: StrategyProgramLike[][];
  allPrograms?: StrategyProgramLike[];
  /** Card headings for combination stacks (e.g. "AMPG + PSTC"). */
  combinationTitles?: string[];
}

export function normalizeChecklistProgramCode(
  code: string | undefined,
): DocumentChecklistProgramCode | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  if (
    !(DOCUMENT_CHECKLIST_PROGRAM_CODES as readonly string[]).includes(normalized)
  ) {
    return null;
  }
  return normalized as DocumentChecklistProgramCode;
}

function absorbPrograms(
  byCode: Map<DocumentChecklistProgramCode, string>,
  programs: StrategyProgramLike[] | undefined,
) {
  for (const program of programs ?? []) {
    const code = normalizeChecklistProgramCode(program.programCode);
    if (!code) continue;
    if (!byCode.has(code)) {
      byCode.set(code, program.programName?.trim() || code);
    }
  }
}

/** Combination scenario titles are built from program codes joined with " + ". */
function absorbCombinationTitle(
  byCode: Map<DocumentChecklistProgramCode, string>,
  title: string | undefined,
) {
  if (!title?.includes(' + ')) return;
  for (const segment of title.split(' + ')) {
    const code = normalizeChecklistProgramCode(segment);
    if (code && !byCode.has(code)) {
      byCode.set(code, code);
    }
  }
}

/**
 * Collect AMPG/CPTC from the same sources as strategy card badges:
 * recommended + other scenario program lists, allPrograms, and combination titles.
 */
export function extractChecklistProgramsFromVisibleStrategyBadges(
  source: VisibleStrategyBadgeSource | null | undefined,
): ChecklistProgramRef[] {
  if (!source) return [];

  const byCode = new Map<DocumentChecklistProgramCode, string>();

  absorbPrograms(byCode, source.recommendedPrograms);
  for (const programs of source.otherScenarioPrograms ?? []) {
    absorbPrograms(byCode, programs);
  }
  absorbPrograms(byCode, source.allPrograms);
  for (const title of source.combinationTitles ?? []) {
    absorbCombinationTitle(byCode, title);
  }

  return DOCUMENT_CHECKLIST_PROGRAM_CODES.filter((code) => byCode.has(code)).map(
    (code) => ({
      programCode: code,
      programName: byCode.get(code)!,
    }),
  );
}

/**
 * Collect AMPG/CPTC from a full incentive strategy response using the same
 * visible scenario slices as IncentiveStrategySection (recommended + other cards).
 */
export function extractChecklistProgramsFromStrategy(
  data: IncentiveStrategyChecklistSource | null | undefined,
): ChecklistProgramRef[] {
  if (!data) return [];

  const recommendedScenario =
    data.scenarios?.find((scenario) => scenario.isRecommended) ?? null;
  const otherScenarios =
    data.scenarios?.filter((scenario) => !scenario.isRecommended) ?? [];

  return extractChecklistProgramsFromVisibleStrategyBadges({
    recommendedPrograms: recommendedScenario?.programs,
    otherScenarioPrograms: otherScenarios.map((scenario) => scenario.programs ?? []),
    allPrograms: data.allPrograms,
    combinationTitles: [
      ...(recommendedScenario?.title ? [recommendedScenario.title] : []),
      ...otherScenarios.map((scenario) => scenario.title ?? ''),
    ],
  });
}
