import type { BudgetLineWithRelations } from '../cptc-part-a.collector';
import type { ProjectFormatSnapshot } from '../cptc-boc-form-selection';
import {
  buildBudgetLine,
  buildCptcPartAData,
  caCitizenResidency,
} from './cptc-part-a.fixtures';
import { FormatType } from '@storyos/types';

type LineOverrides = Parameters<typeof buildBudgetLine>[0];

export function buildHybridProjectFormat(
  animationPercentage: number | null,
): ProjectFormatSnapshot {
  return {
    formatType: FormatType.FEATURE_FILM,
    isLiveAction: true,
    hasAnimation: true,
    animationPercentage,
  };
}

export function buildHybridBudgetLine(overrides: LineOverrides = {}): BudgetLineWithRelations {
  return buildBudgetLine(overrides);
}

/** Representative hybrid budget: live-action grip spend plus animation labour. */
export function buildRepresentativeHybridBudgetLines(): BudgetLineWithRelations[] {
  return [
    buildHybridBudgetLine({
      amount: 12000,
      account: { code: '23.01', name: 'Key Grip', sortOrder: 1 },
      location: { country: 'CA' },
    }),
    buildHybridBudgetLine({
      amount: 18000,
      budgetAccountId: 'acct-anim',
      account: { id: 'acct-anim', code: '55.10', name: 'Key Animator/Key Posing Artist', sortOrder: 2 },
      personId: 'person-animator',
    }),
  ];
}

export function buildHybridCptcPartAData(
  lines: BudgetLineWithRelations[],
  animationPercentage: number | null,
  residencies: Map<string, { residencyType: string; country: string }> = new Map(),
) {
  return {
    ...buildCptcPartAData(lines, residencies),
    projectFormat: buildHybridProjectFormat(animationPercentage),
  };
}

export function buildHybridAnimatorResidency(personId = 'person-animator') {
  return caCitizenResidency(personId);
}

export { caCitizenResidency };
