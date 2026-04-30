import type { ProgramEstimateSpec } from '@storyos/types';

// ── Existing programs ──
// Phase 3.5 makes these specs the primary dollar-estimation path. Legacy
// estimators remain available only for fallback/parity testing.

const CPTC: ProgramEstimateSpec = {
  programCode: 'CPTC',
  baseType: 'labour',
  baseFilter: { type: 'Labour', provinceMatch: 'CANADIAN' },
  baseRate: 0.25,
  cap: { percentOfNetCost: 0.6 },
};

const FTTC: ProgramEstimateSpec = {
  programCode: 'FTTC',
  province: 'AB',
  baseType: 'total',
  baseFilter: { provinceMatch: 'AB' },
  baseRate: 0.22,
  grindType: 'totalCostProvinceFiltered',
  tiers: [
    { tierCode: 'base', rate: 0.22, label: 'Standard rate' },
    { tierCode: 'elevated', rate: 0.30, label: 'AB-controlled production' },
  ],
};

const OPSTC: ProgramEstimateSpec = {
  programCode: 'OPSTC',
  province: 'ON',
  baseType: 'total',
  baseFilter: { provinceMatch: 'ON' },
  baseRate: 0.215,
  grindType: 'totalCost',
};

const OCASE: ProgramEstimateSpec = {
  programCode: 'OCASE',
  province: 'ON',
  baseType: 'labour',
  baseFilter: {
    type: 'Labour',
    provinceMatch: 'ON',
    requirePost: true,
    activityIfTagged: 'VFX_Animation',
  },
  baseRate: 0.35,
};

const BC_PSTC: ProgramEstimateSpec = {
  programCode: 'BC-PSTC',
  province: 'BC',
  baseType: 'labour',
  baseFilter: { type: 'Labour', provinceMatch: 'BC' },
  baseRate: 0.35,
  bonuses: [
    {
      rate: 0.06,
      condition: {
        kind: 'dayShare',
        bucket: 'provincial',
        fallbackFlag: 'bcRegionalOn',
      },
      label: 'regional',
    },
    {
      rate: 0.06,
      condition: {
        kind: 'dayShare',
        bucket: 'distant',
        fallbackFlag: 'bcDistantOn',
      },
      label: 'distant',
    },
  ],
};

const MB_FTTC_LABOUR_BONUSES = [
  {
    rate: 0.05,
    condition: {
      kind: 'dayShare' as const,
      bucket: 'provincial' as const,
      fallbackFlag: 'mbRuralOn',
    },
    label: 'rural',
  },
  {
    rate: 0.05,
    condition: {
      kind: 'dayShare' as const,
      bucket: 'distant' as const,
      fallbackFlag: 'mbNorthernOn',
    },
    label: 'northern',
  },
  {
    rate: 0.05,
    condition: { kind: 'flag' as const, key: 'mbOwnershipOn' },
    label: 'MB ownership',
  },
];

const MB_FTTC_SPEND_BONUSES = [
  {
    rate: 0.05,
    condition: { kind: 'flag' as const, key: 'mbOwnershipOn' },
    label: 'MB ownership',
  },
];

const MB_FTTC: ProgramEstimateSpec = {
  programCode: 'MB-FTTC',
  province: 'MB',
  baseType: 'labour',
  baseFilter: { type: 'Labour', provinceMatch: 'MB' },
  baseRate: 0.45,
  models: [
    {
      code: 'labour',
      label: 'Labour Model',
      baseType: 'labour',
      baseFilter: { type: 'Labour', provinceMatch: 'MB' },
      rate: 0.45,
      bonuses: MB_FTTC_LABOUR_BONUSES,
    },
    {
      code: 'spend',
      label: 'Spend Model',
      baseType: 'total',
      baseFilter: { provinceMatch: 'MB' },
      rate: 0.30,
      bonuses: MB_FTTC_SPEND_BONUSES,
    },
  ],
};

// ── New programs ──
// These have no legacy estimator — the spec path is the only path.
// Rates are sourced from published program guidelines.

const PSTC: ProgramEstimateSpec = {
  programCode: 'PSTC',
  baseType: 'labour',
  baseFilter: { type: 'Labour', provinceMatch: 'CANADIAN' },
  baseRate: 0.16,
  cmfTopUpIsAssistance: true,
};

const OFTTC: ProgramEstimateSpec = {
  programCode: 'OFTTC',
  province: 'ON',
  baseType: 'labour',
  baseFilter: { type: 'Labour', provinceMatch: 'ON' },
  baseRate: 0.35,
  grindType: 'proportional',
  bonuses: [
    {
      rate: 0.1,
      condition: {
        kind: 'dayShare',
        bucket: 'provincial',
        fallbackFlag: 'onOutsideGTA',
      },
      label: 'outside GTA',
    },
    {
      rate: 0.1,
      condition: {
        kind: 'dayShare',
        bucket: 'distant',
        fallbackFlag: 'onOutsideEntireGTA',
      },
      label: 'outside entire GTA',
    },
  ],
};

const FIBC: ProgramEstimateSpec = {
  programCode: 'FIBC',
  province: 'BC',
  baseType: 'labour',
  baseFilter: { type: 'Labour', provinceMatch: 'BC' },
  baseRate: 0.35,
  excludeIneligible: true,
  cap: { percentOfNetCost: 0.6 },
  bonuses: [
    {
      rate: 0.06,
      condition: {
        kind: 'dayShare',
        bucket: 'provincial',
        fallbackFlag: 'bcRegionalOn',
      },
      label: 'regional',
    },
    {
      rate: 0.06,
      condition: {
        kind: 'dayShare',
        bucket: 'distant',
        fallbackFlag: 'bcDistantOn',
      },
      label: 'distant',
    },
  ],
};

// ── Registry ──

const ALL_SPECS: ProgramEstimateSpec[] = [
  CPTC,
  FTTC,
  OPSTC,
  OCASE,
  BC_PSTC,
  MB_FTTC,
  PSTC,
  OFTTC,
  FIBC,
];

export const PROGRAM_SPECS = new Map<string, ProgramEstimateSpec>(
  ALL_SPECS.map((s) => [s.programCode, s]),
);
