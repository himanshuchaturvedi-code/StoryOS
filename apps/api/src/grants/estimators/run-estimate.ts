import type {
  ProgramEstimateSpec,
  ModelVariant,
  BonusCondition,
  AssistanceContext,
  EligibilityContext,
} from '@storyos/types';
import type {
  EstimatorLine,
  EstimatorMeta,
  EstimatorOpts,
  EstimatorPriorAssistance,
  EstimatorResult,
  EstimatorTraceLine,
} from './types';
import { getPredicate, type PredicateContext } from './predicates';

/** Structured trace of the assistance deduction applied to a program's base. */
interface DeductionTrace {
  grindType: string;
  labourDeduction?: number;
  generalDeduction?: number;
  /** For totalCostProvinceFiltered: federal assistance always deducted. */
  federalDeduction?: number;
  /** For totalCostProvinceFiltered: matching-province assistance deducted. */
  provinceDeduction?: number;
  /** For totalCostProvinceFiltered: unknown-origin assistance NOT deducted but flagged. */
  unknownOriginExcluded?: number;
  province?: string;
  totalDeduction: number;
  /** Pro-ration ratio (base / totalCost) when applicable. */
  ratio?: number;
  /** True when unknown-origin assistance exists — data entry required. */
  missingData?: boolean;
  /** Human-readable formula for display. */
  formula: string;
}

const CANADIAN_PROVINCES = new Set([
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU',
  'ON', 'PE', 'QC', 'SK', 'YT',
]);

// ── Filter logic ──

/**
 * Returns the eligible fraction of a line (0–1). When `excludeIneligible` is
 * true, partially-ineligible lines contribute only their eligible portion.
 * Returns 0 if the line doesn't match the filter at all.
 */
function matchesFilter(
  line: EstimatorLine,
  filter: ProgramEstimateSpec['baseFilter'],
  excludeIneligible?: boolean,
): number {
  if (filter.type && line.type !== filter.type) return 0;

  const province = String(line.province || '').toUpperCase();
  if (filter.provinceMatch === 'CANADIAN') {
    if (!CANADIAN_PROVINCES.has(province)) return 0;
  } else if (filter.provinceMatch) {
    if (province !== filter.provinceMatch) return 0;
  }

  if (filter.requirePost && !/post/i.test(String(line.category || ''))) {
    return 0;
  }
  if (
    filter.activityIfTagged &&
    line.activity &&
    line.activity !== filter.activityIfTagged
  ) {
    return 0;
  }

  if (excludeIneligible) {
    if (line.ineligiblePortion !== undefined) {
      return Math.max(0, Math.min(1, 1 - line.ineligiblePortion));
    }
    if (line.taxCreditIneligible) return 0;
  }

  return 1;
}

function exclusionReason(
  line: EstimatorLine,
  filter: ProgramEstimateSpec['baseFilter'],
  excludeIneligible?: boolean,
): string | undefined {
  if (excludeIneligible) {
    if (line.ineligiblePortion !== undefined && line.ineligiblePortion >= 1) {
      return 'Tax credit ineligible';
    }
    if (line.taxCreditIneligible && line.ineligiblePortion === undefined) {
      return 'Tax credit ineligible';
    }
  }

  if (filter.type && line.type !== filter.type) {
    return `Not a ${filter.type.toLowerCase()} line`;
  }

  const province = String(line.province || '').toUpperCase();
  if (filter.provinceMatch === 'CANADIAN') {
    if (!CANADIAN_PROVINCES.has(province)) return 'Not in a Canadian province';
  } else if (filter.provinceMatch) {
    if (province !== filter.provinceMatch)
      return `Not in ${filter.provinceMatch}`;
  }

  if (filter.requirePost && !/post/i.test(String(line.category || ''))) {
    return 'Not post-production';
  }
  if (
    filter.activityIfTagged &&
    line.activity &&
    line.activity !== filter.activityIfTagged
  ) {
    return `Not ${filter.activityIfTagged.replace('_', '/')}`;
  }

  return undefined;
}

// ── Bonus condition evaluation ──

function evaluateCondition(
  condition: BonusCondition,
  opts: EstimatorOpts,
  predicateCtx: PredicateContext,
): number {
  switch (condition.kind) {
    case 'dayShare': {
      const total = Number(opts.totalDays || 0);
      if (total > 0) {
        const days =
          condition.bucket === 'provincial'
            ? Number(opts.daysProvincial || 0)
            : Number(opts.daysDistant || 0);
        return Math.max(0, Math.min(1, days / total));
      }
      if (condition.fallbackFlag) {
        return opts[condition.fallbackFlag] ? 1 : 0;
      }
      return 0;
    }
    case 'flag':
      return opts[condition.key] ? 1 : 0;
    case 'predicate':
      return getPredicate(condition.name)(predicateCtx);
  }
}

// ── Main kernel ──

const fmtPct = (n: number): string => `${Math.round((n || 0) * 100)}%`;

export interface RunEstimateResult extends EstimatorResult {
  grossBase: number;
  effectiveRate: number;
}

/**
 * Declarative estimator kernel. Evaluates a ProgramEstimateSpec against
 * a set of budget/actual lines and returns an amount + structured trace.
 *
 * Two-phase base deduction (Phase 3.5):
 *   Phase A — Direct assistance from AssistanceContext (grants, deferrals)
 *             deducted according to the spec's grindType.
 *   Phase B — Credit-to-credit grinding from PriorAssistanceLedger
 *             (provincial yields reducing federal base).
 */
export function runEstimate(args: {
  spec: ProgramEstimateSpec;
  lines: EstimatorLine[];
  opts?: EstimatorOpts;
  meta?: EstimatorMeta;
  priorAssistance?: EstimatorPriorAssistance;
  assistanceContext?: AssistanceContext;
  eligibilityContext?: EligibilityContext;
}): RunEstimateResult {
  const { spec, lines, opts, meta, priorAssistance, assistanceContext, eligibilityContext } = args;

  // Multi-model evaluation (e.g. MB-FTTC labour vs spend)
  if (spec.models && spec.models.length > 0) {
    return evaluateMultiModel(spec, lines, opts, meta, priorAssistance, assistanceContext, eligibilityContext);
  }

  return runEstimateSingle(spec, lines, opts ?? {}, meta ?? {}, priorAssistance, assistanceContext, eligibilityContext);
}

/** Core single-model estimation kernel. */
function runEstimateSingle(
  spec: ProgramEstimateSpec,
  lines: EstimatorLine[],
  opts: EstimatorOpts,
  meta: EstimatorMeta,
  priorAssistance: EstimatorPriorAssistance | undefined,
  assistanceContext: AssistanceContext | undefined,
  eligibilityContext: EligibilityContext | undefined,
): RunEstimateResult {
  // 1. Filter lines and compute gross base
  let grossBase = 0;
  const excludeIneligible = spec.excludeIneligible ?? false;
  const traceLines: EstimatorTraceLine[] = lines.map((line) => {
    const amount = Number(line.amount || 0);
    const eligibleFraction = matchesFilter(line, spec.baseFilter, excludeIneligible);
    const included = eligibleFraction > 0;
    const eligibleAmount = amount * eligibleFraction;
    if (included) grossBase += eligibleAmount;
    return {
      description: line.description,
      glCode: line.glCode,
      budgetTemplateCategory: line.budgetTemplateCategory,
      type: line.type,
      province: line.province,
      amount,
      included,
      reason: included ? undefined : exclusionReason(line, spec.baseFilter, excludeIneligible),
      ...(eligibleFraction > 0 && eligibleFraction < 1 ? { eligibleFraction } : {}),
    };
  });

  // 2a. Phase A — Direct assistance deduction (from AssistanceContext)
  let directDeduction = 0;
  let effectiveTotalAssistance = 0;
  let deductionTrace: DeductionTrace | undefined;

  if (assistanceContext) {
    let labourAst = assistanceContext.labourAssistance;
    let generalAst = assistanceContext.generalAssistance;
    let totalAst = assistanceContext.totalAssistance;
    const totalCost = assistanceContext.totalCost;

    if (spec.cmfTopUpIsAssistance) {
      const cmfTopUp = assistanceContext.lines
        .filter((l) => !l.isAssistance && /cmf/i.test(l.name))
        .reduce((sum, l) => sum + l.amount, 0);
      generalAst += cmfTopUp;
      totalAst += cmfTopUp;
    }

    effectiveTotalAssistance = totalAst;

    const grindType = spec.grindType ?? 'standard';
    switch (grindType) {
      case 'standard': {
        const ratio = totalCost > 0 ? grossBase / totalCost : 0;
        const generalProrated = generalAst * ratio;
        directDeduction = labourAst + generalProrated;
        deductionTrace = {
          grindType: 'standard',
          labourDeduction: labourAst,
          generalDeduction: generalProrated,
          totalDeduction: directDeduction,
          formula: `labour ${labourAst.toFixed(0)} (1:1) + general ${generalAst.toFixed(0)} × ${ratio.toFixed(4)} = ${generalProrated.toFixed(0)}`,
        };
        break;
      }
      case 'proportional': {
        // OFTTC-style: labour assistance deducted 1:1 from the eligible base;
        // general assistance pro-rated by program's share of total cost.
        // Semantically distinct from 'standard' — this is the policy-defined
        // proportional treatment for provincial Canadian-controlled credits.
        const ratio = totalCost > 0 ? grossBase / totalCost : 0;
        const generalProrated = generalAst * ratio;
        directDeduction = labourAst + generalProrated;
        deductionTrace = {
          grindType: 'proportional',
          labourDeduction: labourAst,
          generalDeduction: generalProrated,
          totalDeduction: directDeduction,
          ratio,
          formula: `labour ${labourAst.toFixed(0)} (1:1) + general ${generalAst.toFixed(0)} × ${ratio.toFixed(4)} = ${generalProrated.toFixed(0)}`,
        };
        break;
      }
      case 'totalCostProvinceFiltered': {
        const province = spec.province;
        const byProvince = assistanceContext.assistanceByProvince;
        const fedAst = assistanceContext.federalAssistance;
        const unknownAst = assistanceContext.unknownOriginAssistance;
        const provinceAst = province ? (byProvince[province] ?? 0) : 0;

        // Federal: always deducted. Provincial matching: deducted. Unknown: excluded but flagged.
        directDeduction = fedAst + provinceAst;
        const hasMissingData = unknownAst > 0;

        deductionTrace = {
          grindType: 'totalCostProvinceFiltered',
          province: province ?? undefined,
          federalDeduction: fedAst,
          provinceDeduction: provinceAst,
          unknownOriginExcluded: unknownAst,
          totalDeduction: directDeduction,
          missingData: hasMissingData,
          formula: `federal ${fedAst.toFixed(0)} + ${province ?? '??'}-origin ${provinceAst.toFixed(0)}${hasMissingData ? ` (${unknownAst.toFixed(0)} unknown-origin EXCLUDED — needs data entry)` : ''}`,
        };
        break;
      }
      case 'programSpecific':
        directDeduction = labourAst;
        deductionTrace = {
          grindType: 'programSpecific',
          labourDeduction: labourAst,
          totalDeduction: directDeduction,
          formula: `labourAssistance ${labourAst.toFixed(0)} (deprecated — use totalCostProvinceFiltered)`,
        };
        break;
      case 'totalCost':
        directDeduction = totalAst;
        deductionTrace = {
          grindType: 'totalCost',
          totalDeduction: directDeduction,
          formula: `full totalAssistance ${totalAst.toFixed(0)}`,
        };
        break;
    }
  }

  // 2b. Phase B — Ledger-based credit-to-credit grinding
  const ledgerDeduction =
    Number(priorAssistance?.labour ?? 0) + Number(priorAssistance?.total ?? 0);

  const netBase = Math.max(0, grossBase - directDeduction - ledgerDeduction);

  // 3. Compute effective rate
  //
  // Three-phase resolution:
  //   A) Tier selection — if spec has tiers AND EligibilityContext is present,
  //      pick the highest-rate qualifying tier deterministically.
  //   B) Bonus modifiers — additive rate components (dayShare, flag) gated
  //      by EligibilityContext modifiers when available.
  //   C) Legacy fallback — if no EligibilityContext, use the old
  //      bonus/predicate path for backward compatibility.
  const predicateCtx: PredicateContext = { lines, opts, meta };
  const bonusComponents: Array<{
    label: string;
    rate: number;
    conditionValue: number;
  }> = [];
  let selectedTierCode: string | undefined;
  let effectiveRate = spec.baseRate;

  // Phase A: Eligibility-driven tier selection
  if (spec.tiers && spec.tiers.length > 0 && eligibilityContext) {
    const qualifyingTierCodes = new Set(
      eligibilityContext.tiers
        .filter((t) => t.qualifies)
        .map((t) => t.tierCode),
    );
    const sorted = [...spec.tiers].sort((a, b) => b.rate - a.rate);
    const selected = sorted.find((t) => qualifyingTierCodes.has(t.tierCode));
    if (selected) {
      effectiveRate = selected.rate;
      selectedTierCode = selected.tierCode;
    }
  }

  // Phase B/C: Bonus modifiers
  if (spec.bonuses) {
    const modifierQualification = eligibilityContext
      ? new Map(eligibilityContext.modifiers.map((m) => [m.modifierCode, m.qualifies]))
      : null;

    for (const bonus of spec.bonuses) {
      let conditionValue: number;

      if (modifierQualification) {
        const qualified = modifierQualification.get(bonus.label);
        if (qualified === false) {
          conditionValue = 0;
        } else if (qualified === true) {
          conditionValue = evaluateCondition(bonus.condition, opts, predicateCtx);
          conditionValue = conditionValue > 0 ? conditionValue : 1;
        } else {
          conditionValue = evaluateCondition(bonus.condition, opts, predicateCtx);
        }
      } else {
        conditionValue = evaluateCondition(bonus.condition, opts, predicateCtx);
      }

      effectiveRate += bonus.rate * conditionValue;
      bonusComponents.push({
        label: bonus.label,
        rate: bonus.rate,
        conditionValue,
      });
    }
  }

  // 4. Compute amount
  let amount = netBase * effectiveRate;

  // 5. Apply caps
  const uncappedAmount = netBase * effectiveRate;
  let capApplied = false;
  let capBound: number | undefined;
  let capType: string | undefined;

  if (spec.cap?.absolute !== undefined && amount > spec.cap.absolute) {
    capApplied = true;
    capBound = spec.cap.absolute;
    capType = 'absolute';
    amount = spec.cap.absolute;
  }
  if (spec.cap?.percentOfBase !== undefined) {
    const pctCap = netBase * spec.cap.percentOfBase;
    if (amount > pctCap) {
      capApplied = true;
      capBound = pctCap;
      capType = 'percentOfBase';
      amount = pctCap;
    }
  }
  // percentOfNetCost cap: subtracts ineligibleCostDeduction from totalCost so
  // that ineligible lines reduce the cap ceiling. This is NOT a double-adjustment
  // with the base filter: grossBase already excluded ineligible amounts from the
  // numerator, while the cap operates on the full-cost denominator.
  if (spec.cap?.percentOfNetCost !== undefined && assistanceContext) {
    const netCost = assistanceContext.totalCost
      - effectiveTotalAssistance
      - ledgerDeduction
      - assistanceContext.ineligibleCostDeduction;
    const pctCap = spec.cap.percentOfNetCost * Math.max(0, netCost) * effectiveRate;
    if (amount > pctCap) {
      capApplied = true;
      capBound = pctCap;
      capType = 'percentOfNetCost';
      amount = pctCap;
    }
  }

  // 6. Build human-readable detail
  const detailParts = selectedTierCode
    ? [`${spec.programCode}: ${fmtPct(effectiveRate)} (tier: ${selectedTierCode})`]
    : [`${spec.programCode}: ${fmtPct(spec.baseRate)}`];
  for (const bc of bonusComponents) {
    if (bc.conditionValue > 0) {
      detailParts.push(
        `+ ${bc.label} (×${bc.conditionValue.toFixed(2)}) ${fmtPct(bc.rate)}`,
      );
    }
  }
  if (effectiveRate !== spec.baseRate) {
    detailParts.push(`→ ${fmtPct(effectiveRate)}`);
  }
  const detail = detailParts.join(' ');

  // 7. Build step-by-step calculation explanation
  const calculationSteps = buildCalculationSteps({
    programCode: spec.programCode,
    baseType: spec.baseType,
    grossBase,
    directDeduction,
    ledgerDeduction,
    netBase,
    baseRate: spec.baseRate,
    selectedTierCode,
    bonusComponents,
    effectiveRate,
    amount,
    cap: spec.cap,
    uncappedAmount,
  });

  return {
    amount,
    grossBase,
    effectiveRate,
    detail,
    trace: {
      grossBase,
      directDeduction,
      deductionTrace,
      ledgerDeduction,
      netBase,
      preGrindBase: grossBase,
      postGrindBase: netBase,
      baseRate: spec.baseRate,
      selectedTierCode,
      bonusComponents,
      effectiveRate,
      uncappedAmount,
      capApplied,
      capBound,
      capType,
      lines: traceLines,
      calculationSteps,
    },
  };
}

// ── Multi-model evaluation ──

interface ModelResult {
  code: string;
  label: string;
  amount: number;
  grossBase: number;
  effectiveRate: number;
  detail: string;
  eligible: boolean;
}

function evaluateMultiModel(
  spec: ProgramEstimateSpec,
  lines: EstimatorLine[],
  opts: EstimatorOpts | undefined,
  meta: EstimatorMeta | undefined,
  priorAssistance: EstimatorPriorAssistance | undefined,
  assistanceContext: AssistanceContext | undefined,
  eligibilityContext: EligibilityContext | undefined,
): RunEstimateResult {
  const models = spec.models!;
  const modelResults: ModelResult[] = [];
  const modelTraces: Array<{ code: string; label: string; trace: Record<string, unknown> }> = [];

  let bestResult: RunEstimateResult | null = null;
  let bestModel: ModelVariant | null = null;

  for (const model of models) {
    const modelBonuses = model.bonuses !== undefined ? model.bonuses : spec.bonuses;
    const modelEligible = model.eligible !== false;

    const modelSpec: ProgramEstimateSpec = {
      ...spec,
      baseType: model.baseType,
      baseFilter: model.baseFilter,
      baseRate: model.rate,
      bonuses: modelBonuses,
      tiers: undefined,
      models: undefined,
    };

    const result = runEstimateSingle(
      modelSpec, lines, opts ?? {}, meta ?? {},
      priorAssistance, assistanceContext, eligibilityContext,
    );

    modelResults.push({
      code: model.code,
      label: model.label,
      amount: result.amount,
      grossBase: result.grossBase,
      effectiveRate: result.effectiveRate,
      detail: result.detail,
      eligible: modelEligible,
    });

    modelTraces.push({
      code: model.code,
      label: model.label,
      trace: result.trace ?? {},
    });

    if (modelEligible && (!bestResult || result.amount > bestResult.amount)) {
      bestResult = result;
      bestModel = model;
    }
  }

  // If no model is eligible, fall back to first model (amount will still be
  // computed, but the trace will show it as ineligible)
  if (!bestResult) {
    bestResult = runEstimateSingle(
      { ...spec, models: undefined, tiers: undefined },
      lines, opts ?? {}, meta ?? {},
      priorAssistance, assistanceContext, eligibilityContext,
    );
    bestModel = models[0]!;
  }

  const selectedModelCode = bestModel?.code ?? models[0]!.code;
  const losingModels = modelResults.filter((m) => m.code !== selectedModelCode);

  const selectionReason =
    losingModels.length > 0
      ? losingModels.every((m) => !m.eligible)
        ? `${bestModel!.label} is the only eligible model`
        : `${bestModel!.label} yields ${fmtDollar(bestResult.amount)} vs ${losingModels.map((m) => `${m.label} ${fmtDollar(m.amount)}${!m.eligible ? ' (ineligible)' : ''}`).join(', ')}`
      : `Only one model`;

  const comparisonSteps = modelResults.map(
    (m) => `${m.label} (${m.code}): ${fmtDollar(m.amount)} @ ${fmtPct(m.effectiveRate)} on ${fmtDollar(m.grossBase)}${!m.eligible ? ' [INELIGIBLE]' : ''}`,
  );
  comparisonSteps.push(`→ Selected: ${bestModel?.label ?? '?'} (${selectedModelCode}) — ${selectionReason}`);

  const existingSteps = (bestResult.trace as any)?.calculationSteps as string[] | undefined;
  const calculationSteps = [
    ...(existingSteps ?? []),
    '',
    'Model Comparison:',
    ...comparisonSteps,
  ];

  const bestTrace = bestResult.trace;
  return {
    amount: bestResult.amount,
    grossBase: bestResult.grossBase,
    effectiveRate: bestResult.effectiveRate,
    detail: `${spec.programCode} [${selectedModelCode}]: ${bestResult.detail}`,
    trace: {
      lines: bestTrace?.lines ?? [],
      ...bestTrace,
      selectedModelCode,
      selectionReason,
      modelComparison: modelResults,
      modelTraces,
      calculationSteps,
    },
  };
}

// ── Step-by-step explanation builder ──

const fmtDollar = (n: number): string =>
  '$' + Math.round(n).toLocaleString('en-CA');

function buildCalculationSteps(args: {
  programCode: string;
  baseType: string;
  grossBase: number;
  directDeduction: number;
  ledgerDeduction: number;
  netBase: number;
  baseRate: number;
  selectedTierCode?: string;
  bonusComponents: Array<{ label: string; rate: number; conditionValue: number }>;
  effectiveRate: number;
  amount: number;
  cap?: { absolute?: number; percentOfBase?: number; percentOfNetCost?: number };
  uncappedAmount: number;
}): string[] {
  const steps: string[] = [];
  const baseLabel = args.baseType === 'labour' ? 'Eligible Labour' : 'Eligible Cost';

  // Step 1: Base
  steps.push(`${baseLabel} = ${fmtDollar(args.grossBase)}`);

  // Step 2: Deductions (only if any)
  const totalDeduction = args.directDeduction + args.ledgerDeduction;
  if (totalDeduction > 0) {
    const parts: string[] = [];
    if (args.directDeduction > 0) {
      parts.push(`Direct Assistance ${fmtDollar(args.directDeduction)}`);
    }
    if (args.ledgerDeduction > 0) {
      parts.push(`Prior Credits ${fmtDollar(args.ledgerDeduction)}`);
    }
    steps.push(`Less: ${parts.join(' + ')} = ${fmtDollar(totalDeduction)}`);
    steps.push(`Net Base = ${fmtDollar(args.grossBase)} − ${fmtDollar(totalDeduction)} = ${fmtDollar(args.netBase)}`);
  }

  // Step 3: Rate
  if (args.selectedTierCode) {
    steps.push(`Rate = ${fmtPct(args.effectiveRate)} (tier: ${args.selectedTierCode})`);
  } else {
    const activeBonuses = args.bonusComponents.filter((b) => b.conditionValue > 0);
    if (activeBonuses.length > 0) {
      const bonusParts = activeBonuses
        .map((b) => `${b.label} ${fmtPct(b.rate * b.conditionValue)}`)
        .join(' + ');
      steps.push(`Rate = ${fmtPct(args.baseRate)} base + ${bonusParts} = ${fmtPct(args.effectiveRate)}`);
    } else {
      steps.push(`Rate = ${fmtPct(args.effectiveRate)}`);
    }
  }

  // Step 4: Calculation formula
  const baseForFormula = totalDeduction > 0 ? 'Net Base' : baseLabel;
  const baseValue = totalDeduction > 0 ? args.netBase : args.grossBase;
  steps.push(
    `${args.programCode} = ${baseForFormula} × Rate`,
  );
  steps.push(
    `= ${fmtDollar(baseValue)} × ${fmtPct(args.effectiveRate)}`,
  );
  steps.push(`= ${fmtDollar(args.uncappedAmount)}`);

  // Step 5: Cap
  if (args.amount < args.uncappedAmount - 0.01) {
    if (args.cap?.percentOfNetCost !== undefined) {
      steps.push(`Cap: ${Math.round(args.cap.percentOfNetCost * 100)}% of net cost × rate → ${fmtDollar(args.amount)}`);
    } else if (args.cap?.absolute !== undefined) {
      steps.push(`Cap: absolute ceiling → ${fmtDollar(args.amount)}`);
    } else if (args.cap?.percentOfBase !== undefined) {
      steps.push(`Cap: ${Math.round(args.cap.percentOfBase * 100)}% of base → ${fmtDollar(args.amount)}`);
    } else {
      steps.push(`Capped to ${fmtDollar(args.amount)}`);
    }
  } else if (args.cap) {
    steps.push('Cap: not binding');
  }

  return steps;
}
