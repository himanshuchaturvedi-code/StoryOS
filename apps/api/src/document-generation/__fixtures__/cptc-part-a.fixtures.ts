import { ExpenseType } from '@storyos/types';
import type { BudgetLineWithRelations } from '../cptc-part-a.collector';

type LineOverrides = Omit<
  Partial<BudgetLineWithRelations>,
  'account' | 'vendor' | 'location' | 'amount' | 'labourAmount'
> & {
  amount?: number;
  labourAmount?: number | null;
  account?: Partial<BudgetLineWithRelations['account']>;
  vendor?: Partial<NonNullable<BudgetLineWithRelations['vendor']>> | null;
  location?: Partial<NonNullable<BudgetLineWithRelations['location']>> | null;
};

let lineCounter = 0;

export function buildBudgetLine(overrides: LineOverrides = {}): BudgetLineWithRelations {
  lineCounter += 1;
  const id = overrides.id ?? `line-${lineCounter}`;
  const accountId = overrides.budgetAccountId ?? `acct-${lineCounter}`;

  const accountDefaults = {
    id: accountId,
    code: overrides.account?.code ?? '1000',
    name: overrides.account?.name ?? 'Test Account',
    isHeader: overrides.account?.isHeader ?? false,
    parentId: overrides.account?.parentId ?? null,
    sortOrder: overrides.account?.sortOrder ?? lineCounter,
    accountType: overrides.account?.accountType ?? 'BELOW_THE_LINE_PRODUCTION',
    roleMappings: overrides.account?.roleMappings ?? [],
  };

  return {
    id,
    budgetVersionId: overrides.budgetVersionId ?? 'version-1',
    budgetAccountId: accountId,
    organizationId: overrides.organizationId ?? 'org-1',
    description: overrides.description ?? null,
    quantity: overrides.quantity ?? null,
    unitCost: overrides.unitCost ?? null,
    amount: overrides.amount ?? 1000,
    currency: overrides.currency ?? 'CAD',
    fringeRate: overrides.fringeRate ?? null,
    notes: overrides.notes ?? null,
    personId: overrides.personId ?? null,
    vendorId: overrides.vendorId ?? null,
    locationId: overrides.locationId ?? null,
    productionPhaseId: overrides.productionPhaseId ?? null,
    labourAmount: overrides.labourAmount ?? null,
    expenseType: overrides.expenseType ?? null,
    activityType: overrides.activityType ?? null,
    isServiceContract: overrides.isServiceContract ?? null,
    taxCreditIneligible: overrides.taxCreditIneligible ?? false,
    taxCreditIneligibleReason: overrides.taxCreditIneligibleReason ?? null,
    sortOrder: overrides.sortOrder ?? 0,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
    deletedAt: overrides.deletedAt ?? null,
    account: {
      ...accountDefaults,
      ...overrides.account,
      roleMappings: overrides.account?.roleMappings ?? accountDefaults.roleMappings,
    } as BudgetLineWithRelations['account'],
    person: overrides.person ?? null,
    vendor:
      overrides.vendor === null
        ? null
        : overrides.vendor
          ? ({
              id: 'vendor-1',
              country: 'CA',
              principalPersonId: null,
              ...overrides.vendor,
            } as NonNullable<BudgetLineWithRelations['vendor']>)
          : null,
    location:
      overrides.location === null
        ? null
        : overrides.location
          ? ({
              id: 'loc-1',
              country: 'CA',
              ...overrides.location,
            } as NonNullable<BudgetLineWithRelations['location']>)
          : null,
    productionPhase: overrides.productionPhase ?? null,
  } as unknown as BudgetLineWithRelations;
}

export function buildCptcPartAData(
  lines: BudgetLineWithRelations[],
  residencies: Map<string, { residencyType: string; country: string }> = new Map(),
) {
  return {
    project: { id: 'project-1', title: 'Test Production' },
    budgetVersionId: 'version-1',
    budgetVersionName: 'Locked v1',
    lines,
    residencies,
  };
}

export function caCitizenResidency(personId: string) {
  return new Map([[personId, { residencyType: 'CITIZEN', country: 'CA' }]]);
}

export { ExpenseType };
