import type { ProgramConfig, GrindCondition } from '@storyos/types';

// ── Program configurations ──
// Single source of truth for tier, province, grind relationships,
// mutual exclusions, and legacy estimator codes.
//
// Tier numbering: regional=0, provincial=1, federal=2.
// Lower tiers evaluate first in the topo sort tiebreaker.
//
// Grind edges point FROM the program whose yield grinds TO the
// program whose base is reduced. Provincial credits grind federal
// bases — never the reverse. CMF is a funding source, not a
// program; its assistance effect is handled by AssistanceContext.

const CPTC: ProgramConfig = {
  programCode: 'CPTC',
  tier: 2,
  province: null,
  grinds: [],
  mutuallyExclusiveWith: ['PSTC'],
};

const PSTC: ProgramConfig = {
  programCode: 'PSTC',
  tier: 2,
  province: null,
  grinds: [],
  mutuallyExclusiveWith: ['CPTC'],
};

const FTTC: ProgramConfig = {
  programCode: 'FTTC',
  tier: 1,
  province: 'AB',
  grinds: [
    { targetProgramCode: 'CPTC', appliesTo: 'labour', rate: 1, reason: 'Provincial credit grinds federal eligible labour.' },
    { targetProgramCode: 'PSTC', appliesTo: 'labour', rate: 1, reason: 'AB provincial credit grinds federal service labour.', condition: { type: 'always' } },
  ],
  mutuallyExclusiveWith: ['AMPG'],
};

const OFTTC: ProgramConfig = {
  programCode: 'OFTTC',
  tier: 1,
  province: 'ON',
  grinds: [
    { targetProgramCode: 'CPTC', appliesTo: 'labour', rate: 1, reason: 'Provincial credit grinds federal eligible labour.' },
  ],
  mutuallyExclusiveWith: ['OPSTC'],
};

const OPSTC: ProgramConfig = {
  programCode: 'OPSTC',
  tier: 1,
  province: 'ON',
  grinds: [
    { targetProgramCode: 'PSTC', appliesTo: 'labour', rate: 1, reason: 'Provincial credit grinds federal eligible labour.' },
  ],
  mutuallyExclusiveWith: ['OFTTC'],
};

const FIBC: ProgramConfig = {
  programCode: 'FIBC',
  tier: 1,
  province: 'BC',
  grinds: [
    { targetProgramCode: 'CPTC', appliesTo: 'labour', rate: 1, reason: 'Provincial credit grinds federal eligible labour.' },
    {
      targetProgramCode: 'FTTC',
      appliesTo: 'total',
      rate: 1,
      reason: 'BC credit grinds AB base when production spans both provinces.',
      condition: { type: 'jurisdictionOverlap', requires: ['AB', 'BC'], minBaseAmount: 10_000 },
    },
  ],
  mutuallyExclusiveWith: ['BC-PSTC'],
};

const BC_PSTC: ProgramConfig = {
  programCode: 'BC-PSTC',
  tier: 1,
  province: 'BC',
  grinds: [
    { targetProgramCode: 'PSTC', appliesTo: 'labour', rate: 1, reason: 'Provincial credit grinds federal eligible labour.' },
  ],
  mutuallyExclusiveWith: ['FIBC'],
};

const MB_FTTC: ProgramConfig = {
  programCode: 'MB-FTTC',
  tier: 1,
  province: 'MB',
  grinds: [
    { targetProgramCode: 'CPTC', appliesTo: 'labour', rate: 1, reason: 'Provincial credit grinds federal eligible labour.' },
    { targetProgramCode: 'PSTC', appliesTo: 'labour', rate: 1, reason: 'MB provincial credit grinds federal service labour.', condition: { type: 'always' } },
  ],
  mutuallyExclusiveWith: [],
};

const OCASE: ProgramConfig = {
  programCode: 'OCASE',
  tier: 1,
  province: 'ON',
  grinds: [
    { targetProgramCode: 'CPTC', appliesTo: 'labour', rate: 1, reason: 'Provincial credit grinds federal eligible labour.' },
  ],
  mutuallyExclusiveWith: [],
};

const AMPG: ProgramConfig = {
  programCode: 'AMPG',
  tier: 0,
  province: 'AB',
  grinds: [],
  mutuallyExclusiveWith: ['FTTC'],
};

const DEV_PROGRAM: ProgramConfig = {
  programCode: 'DEV-PROGRAM',
  tier: 99,
  province: null,
  grinds: [],
  mutuallyExclusiveWith: [],
  isNonProduction: true,
};

// ── Registry ──

const ALL_CONFIGS: ProgramConfig[] = [
  CPTC, PSTC,
  FTTC, OFTTC, OPSTC, FIBC, BC_PSTC, MB_FTTC,
  OCASE, AMPG,
  DEV_PROGRAM,
];

export const PROGRAM_CONFIGS: ReadonlyMap<string, ProgramConfig> = new Map(
  ALL_CONFIGS.map((c) => [c.programCode, c]),
);

// ── Derived helpers ──

export function getProgramTier(programCode: string): number {
  return PROGRAM_CONFIGS.get(programCode)?.tier ?? 1;
}

export function getProgramProvince(programCode: string): string | null {
  return PROGRAM_CONFIGS.get(programCode)?.province ?? null;
}

export function getNonProductionCodes(): Set<string> {
  const codes = new Set<string>();
  for (const config of PROGRAM_CONFIGS.values()) {
    if (config.isNonProduction) codes.add(config.programCode);
  }
  return codes;
}

/** Flat grind rule — the shape consumed by calculatePriorAssistance / describeRules. */
export interface FlatGrindRule {
  sourceProgramCode: string;
  targetProgramCode: string;
  appliesTo: 'total' | 'labour' | 'nonLabour';
  rate: number;
  reason: string;
  condition?: GrindCondition;
}

let _grindRulesCache: FlatGrindRule[] | null = null;

export function getAllGrindRules(): readonly FlatGrindRule[] {
  if (!_grindRulesCache) {
    _grindRulesCache = [];
    for (const config of PROGRAM_CONFIGS.values()) {
      for (const edge of config.grinds) {
        _grindRulesCache.push({
          sourceProgramCode: config.programCode,
          targetProgramCode: edge.targetProgramCode,
          appliesTo: edge.appliesTo,
          rate: edge.rate,
          reason: edge.reason,
          condition: edge.condition,
        });
      }
    }
  }
  return _grindRulesCache;
}

export function isExcludedPair(programCodes: string[]): boolean {
  const codeSet = new Set(programCodes);
  for (const code of programCodes) {
    const config = PROGRAM_CONFIGS.get(code);
    if (!config) continue;
    for (const exclusive of config.mutuallyExclusiveWith) {
      if (codeSet.has(exclusive)) return true;
    }
  }
  return false;
}

// ── Validator ──

export function validateProgramConfigs(): string[] {
  const errors: string[] = [];
  const codes = new Set(PROGRAM_CONFIGS.keys());

  for (const config of PROGRAM_CONFIGS.values()) {
    // Grind targets must exist and not self-reference
    for (const edge of config.grinds) {
      if (edge.targetProgramCode === config.programCode) {
        errors.push(`${config.programCode} has a grind edge targeting itself`);
      }
      if (!codes.has(edge.targetProgramCode)) {
        errors.push(
          `${config.programCode} grinds unknown program ${edge.targetProgramCode}`,
        );
      }
    }

    // Exclusion partners must exist and be symmetric
    for (const partner of config.mutuallyExclusiveWith) {
      if (!codes.has(partner)) {
        errors.push(
          `${config.programCode} excludes unknown program ${partner}`,
        );
        continue;
      }
      const partnerConfig = PROGRAM_CONFIGS.get(partner)!;
      if (!partnerConfig.mutuallyExclusiveWith.includes(config.programCode)) {
        errors.push(
          `Exclusion asymmetry: ${config.programCode} excludes ${partner} but not vice versa`,
        );
      }
    }
  }

  // Cycle detection in grind DAG (DFS with coloring)
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const code of codes) color.set(code, WHITE);

  function dfs(node: string): boolean {
    color.set(node, GRAY);
    const config = PROGRAM_CONFIGS.get(node);
    if (config) {
      for (const edge of config.grinds) {
        const c = color.get(edge.targetProgramCode);
        if (c === GRAY) return true;
        if (c === WHITE && dfs(edge.targetProgramCode)) return true;
      }
    }
    color.set(node, BLACK);
    return false;
  }

  for (const code of codes) {
    if (color.get(code) === WHITE && dfs(code)) {
      errors.push(`Cycle detected in grind DAG involving ${code}`);
    }
  }

  return errors;
}
