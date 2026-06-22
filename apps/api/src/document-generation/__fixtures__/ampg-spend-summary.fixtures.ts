import type { AmpgBudgetData } from '../ampg-budget.collector';
import { buildBudgetLine } from './cptc-part-a.fixtures';

export function buildAmpgBudgetData(
  lines: AmpgBudgetData['lines'],
  overrides: Partial<Omit<AmpgBudgetData, 'lines'>> = {},
): AmpgBudgetData {
  return {
    project: overrides.project ?? { id: 'project-1', title: 'Alberta Pilot Production' },
    budgetVersionId: overrides.budgetVersionId ?? 'version-1',
    budgetVersionName: overrides.budgetVersionName ?? 'Locked v1',
    lines,
  };
}

export function buildAlbertaLine(
  overrides: Parameters<typeof buildBudgetLine>[0] = {},
) {
  return buildBudgetLine({
    location: { country: 'CA', provinceState: 'CA-AB' },
    ...overrides,
  });
}

export function buildNonAlbertaLine(
  overrides: Parameters<typeof buildBudgetLine>[0] = {},
) {
  return buildBudgetLine({
    location: { country: 'CA', provinceState: 'CA-ON' },
    ...overrides,
  });
}

export { buildBudgetLine };
