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

function telefilmSectionNumber(accountCode: string): number | null {
  const match = accountCode.match(/^(\d+)\./);
  if (!match) return null;
  return Number.parseInt(match[1]!, 10);
}

export function isAnimationBudgetSectionAccount(accountCode: string): boolean {
  const section = telefilmSectionNumber(accountCode);
  return section != null && section >= 52 && section <= 59;
}

export function sumAnimationSectionSpend(lines: BudgetLineWithRelations[]): number {
  let total = 0;
  for (const line of lines) {
    if (line.taxCreditIneligible) continue;
    const amount = Number(line.amount);
    if (amount === 0) continue;
    if (!isAnimationBudgetSectionAccount(line.account.code)) continue;
    total += amount;
  }
  return total;
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
        'Project format is not set; defaulting to CPTC Breakdown of Costs form 01F21 (live action).',
    });
    return {
      formCode: CPTC_BOC_FORM_CODE_LIVE_ACTION,
      reason: 'missing_project_format',
      warnings,
    };
  }

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
        message: `Hybrid project: animation percentage (${pct}%) is ≥50%; using CPTC form 01F22 (animation).`,
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
        message: `Hybrid project: animation percentage (${pct}%) is <50%; using CPTC form 01F21 (live action).`,
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
        'Hybrid project format is ambiguous (animation percentage not set); defaulting to CPTC form 01F21 (live action).',
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
  const warnings: DocumentWarning[] = [];

  if (formCode === CPTC_BOC_FORM_CODE_LIVE_ACTION && animationSpend > 0) {
    warnings.push({
      severity: 'warning',
      message: `Form 01F21 selected but locked budget has spend in Telefilm animation sections 52–59 (total ${animationSpend.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}); confirm predominant format or use form 01F22.`,
    });
  }

  if (formCode === CPTC_BOC_FORM_CODE_ANIMATION && animationSpend === 0) {
    warnings.push({
      severity: 'warning',
      message:
        'Form 01F22 selected but locked budget has no spend in Telefilm animation sections 52–59; confirm animation format or budget mapping.',
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
