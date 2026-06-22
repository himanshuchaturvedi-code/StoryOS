import type { BudgetLineWithRelations } from '../cptc-part-a.collector';
import {
  buildBudgetLine,
  buildCptcPartAData,
  caCitizenResidency,
} from './cptc-part-a.fixtures';
import { FormatType } from '@storyos/types';

type LineOverrides = Parameters<typeof buildBudgetLine>[0];

export function buildAnimationBudgetLine(
  overrides: LineOverrides = {},
): BudgetLineWithRelations {
  return buildBudgetLine(overrides);
}

export function buildAnimationCptcPartAData(
  lines: BudgetLineWithRelations[],
  residencies: Map<string, { residencyType: string; country: string }> = new Map(),
) {
  return {
    ...buildCptcPartAData(lines, residencies),
    projectFormat: {
      formatType: FormatType.ANIMATION_FEATURE,
      isLiveAction: false,
      hasAnimation: true,
      animationPercentage: null,
    },
  };
}

export function caAnimationResidency(...personIds: string[]) {
  const map = new Map<string, { residencyType: string; country: string }>();
  for (const personId of personIds) {
    map.set(personId, { residencyType: 'CITIZEN', country: 'CA' });
  }
  return map;
}

export { caCitizenResidency };
