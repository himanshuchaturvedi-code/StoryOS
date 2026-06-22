import { FormatType, type DocumentWarning } from '@storyos/types';
import type { CptcBocFormCode } from '@storyos/program-registry';
import {
  CPTC_BOC_FORM_CODE_ANIMATION,
  CPTC_BOC_FORM_CODE_LIVE_ACTION,
} from '@storyos/program-registry';
import type { BudgetLineWithRelations } from './cptc-part-a.collector';

export interface ProjectFormatSnapshot {
  formatType: FormatType;
  isLiveAction: boolean;
  hasAnimation: boolean;
  animationPercentage: number | null;
}

export interface CptcBocFormSelection {
  formCode: CptcBocFormCode;
  reason: string;
  warnings: DocumentWarning[];
}

const ANIMATION_FORMAT_TYPES = new Set<FormatType>([
  FormatType.ANIMATION_FEATURE,
  FormatType.ANIMATION_SERIES,
]);

const ANIMATION_SECTION_MIN = 52;
const ANIMATION_SECTION_MAX = 59;
const LIVE_ACTION_PRODUCTION_SECTION_MIN = 12;
const LIVE_ACTION_PRODUCTION_SECTION_MAX = 51;

function telefilmSectionNumber(accountCode: string): number | null {
  const match = accountCode.match(/^(\d+)\./);
  if (!match) return null;
  return Number.parseInt(match[1]!, 10);
}

export function isAnimationBudgetSectionAccount(accountCode: string): boolean {
  const section = telefilmSectionNumber(accountCode);
  return section != null && section >= ANIMATION_SECTION_MIN && section <= ANIMATION_SECTION_MAX;
}

/** Telefilm live-action production sections (12–51) used for hybrid QA guardrails. */
export function isLiveActionProductionSectionAccount(accountCode: string): boolean {
  const section = telefilmSectionNumber(accountCode);
  return (
    section != null &&
    section >= LIVE_ACTION_PRODUCTION_SECTION_MIN &&
    section <= LIVE_ACTION_PRODUCTION_SECTION_MAX
  );
}

function sumEligibleLineAmount(lines: BudgetLineWithRelations[], predicate: (code: string) => boolean): number {
  let total = 0;
  for (const line of lines) {
    if (line.taxCreditIneligible) continue;
    const amount = Number(line.amount);
    if (amount === 0) continue;
    if (!predicate(line.account.code)) continue;
    total += amount;
  }
  return total;
}

export function sumAnimationSectionSpend(lines: BudgetLineWithRelations[]): number {
  return sumEligibleLineAmount(lines, isAnimationBudgetSectionAccount);
}

export function sumLiveActionProductionSectionSpend(lines: BudgetLineWithRelations[]): number {
  return sumEligibleLineAmount(lines, isLiveActionProductionSectionAccount);
}

function formatBudgetTotal(amount: number): string {
  return amount.toLocaleString('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildAmbiguousProjectFormatWarnings(
  format: ProjectFormatSnapshot,
): DocumentWarning[] {
  const warnings: DocumentWarning[] = [];

  if (
    ANIMATION_FORMAT_TYPES.has(format.formatType) &&
    format.isLiveAction &&
    !format.hasAnimation
  ) {
    warnings.push({
      severity: 'warning',
      message:
        'Project format is ambiguous: animation format type is set alongside live-action-only flags; confirm predominant format before filing.',
    });
  }

  if (
    !ANIMATION_FORMAT_TYPES.has(format.formatType) &&
    format.isLiveAction &&
    format.hasAnimation &&
    format.animationPercentage == null
  ) {
    warnings.push({
      severity: 'warning',
      message:
        'Hybrid project format is ambiguous (animation percentage not set); predominant format could not be determined from ProjectFormat alone.',
    });
  }

  return warnings;
}

function isHybridProject(format: ProjectFormatSnapshot): boolean {
  return format.isLiveAction && format.hasAnimation;
}

function resolveFromProjectFormat(
  format: ProjectFormatSnapshot | null | undefined,
): CptcBocFormSelection {
  const warnings: DocumentWarning[] = [];

  if (format == null) {
    warnings.push({
      severity: 'warning',
      message:
        'Project format is not set; defaulting to CPTC Breakdown of Costs form 01F21 (live action). Confirm predominant format before filing.',
    });
    return {
      formCode: CPTC_BOC_FORM_CODE_LIVE_ACTION,
      reason: 'missing_project_format',
      warnings,
    };
  }

  warnings.push(...buildAmbiguousProjectFormatWarnings(format));

  if (ANIMATION_FORMAT_TYPES.has(format.formatType)) {
    return {
      formCode: CPTC_BOC_FORM_CODE_ANIMATION,
      reason: 'animation_format_type',
      warnings,
    };
  }

  if (!format.isLiveAction && format.hasAnimation) {
    return {
      formCode: CPTC_BOC_FORM_CODE_ANIMATION,
      reason: 'animation_only_production',
      warnings,
    };
  }

  if (isHybridProject(format)) {
    const pct = format.animationPercentage;
    if (pct != null && pct >= 50) {
      warnings.push({
        severity: 'info',
        message: `Hybrid project: animation percentage (${pct}%) is ≥50%; predominant format is animation — using CPTC form 01F22.`,
      });
      return {
        formCode: CPTC_BOC_FORM_CODE_ANIMATION,
        reason: 'hybrid_animation_percentage',
        warnings,
      };
    }

    if (pct != null && pct < 50) {
      warnings.push({
        severity: 'info',
        message: `Hybrid project: animation percentage (${pct}%) is <50%; predominant format is live action — using CPTC form 01F21.`,
      });
      return {
        formCode: CPTC_BOC_FORM_CODE_LIVE_ACTION,
        reason: 'hybrid_live_action_percentage',
        warnings,
      };
    }

    warnings.push({
      severity: 'warning',
      message:
        'Hybrid project format is ambiguous (animation percentage not set); defaulting to CPTC form 01F21 (live action). Confirm predominant format before filing.',
    });
    return {
      formCode: CPTC_BOC_FORM_CODE_LIVE_ACTION,
      reason: 'hybrid_ambiguous',
      warnings,
    };
  }

  return {
    formCode: CPTC_BOC_FORM_CODE_LIVE_ACTION,
    reason: 'live_action_default',
    warnings,
  };
}

export function buildCptcBocBudgetFormWarnings(
  formCode: CptcBocFormCode,
  lines: BudgetLineWithRelations[],
): DocumentWarning[] {
  const animationSpend = sumAnimationSectionSpend(lines);
  const liveActionSpend = sumLiveActionProductionSectionSpend(lines);
  const warnings: DocumentWarning[] = [];

  if (formCode === CPTC_BOC_FORM_CODE_LIVE_ACTION && animationSpend > 0) {
    warnings.push({
      severity: 'warning',
      message: `Form 01F21 selected but locked budget has spend in Telefilm animation sections 52–59 (total ${formatBudgetTotal(animationSpend)}); confirm predominant format or use form 01F22.`,
    });
  }

  if (formCode === CPTC_BOC_FORM_CODE_ANIMATION && animationSpend === 0) {
    warnings.push({
      severity: 'warning',
      message:
        'Form 01F22 selected but locked budget has no spend in Telefilm animation sections 52–59; confirm animation format or budget mapping.',
    });
  }

  if (formCode === CPTC_BOC_FORM_CODE_ANIMATION && liveActionSpend > 0) {
    warnings.push({
      severity: 'warning',
      message: `Form 01F22 selected but locked budget has material spend in Telefilm live-action production sections 12–51 (total ${formatBudgetTotal(liveActionSpend)}); confirm predominant format or use form 01F21.`,
    });
  }

  return warnings;
}

export function resolveCptcBocFormSelection(
  projectFormat: ProjectFormatSnapshot | null | undefined,
  lines: BudgetLineWithRelations[],
): CptcBocFormSelection {
  const selection = resolveFromProjectFormat(projectFormat);
  selection.warnings.push(...buildCptcBocBudgetFormWarnings(selection.formCode, lines));
  return selection;
}
