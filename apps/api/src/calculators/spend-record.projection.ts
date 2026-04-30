import { Prisma } from '@storyos/database';
import { EvaluationSource } from '@storyos/types';
import type { SpendRecord } from '@storyos/types';

type BudgetLineWithRelations = Prisma.BudgetLineGetPayload<{
  include: {
    account: true;
    location: true;
    vendor: { include: { principalPerson: true } };
  };
}>;

type ExpenseFactWithRelations = Prisma.ExpenseFactGetPayload<{
  include: {
    actualLine: true;
    location: true;
    vendor: { include: { principalPerson: true } };
  };
}>;

function resolveIsLabour(
  expenseType: string | null,
  accountType: string | null,
): boolean {
  if (expenseType === 'LABOUR' || expenseType === 'MIXED') return true;
  if (expenseType === 'NON_LABOUR') return false;
  if (accountType === 'ABOVE_THE_LINE') return true;
  if (accountType === 'BELOW_THE_LINE_PRODUCTION') return true;
  if (accountType === 'BELOW_THE_LINE_POST') return true;
  return false;
}

export function budgetLineToSpendRecord(line: BudgetLineWithRelations): SpendRecord {
  const accountType = line.account?.accountType ?? null;

  const effectivePersonId =
    line.personId ??
    line.vendor?.principalPersonId ??
    null;

  return {
    sourceId: line.id,
    sourceType: EvaluationSource.BUDGET,
    amount: line.amount.toString(),
    labourAmount: line.labourAmount?.toString() ?? null,
    isLabour: resolveIsLabour(line.expenseType, accountType),
    isService: line.isServiceContract ?? false,
    eligiblePortion: '1',
    effectivePersonId,
    vendorId: line.vendorId,
    locationId: line.locationId,
    productionPhaseId: line.productionPhaseId,
    budgetAccountId: line.budgetAccountId,
    activityType: line.activityType ?? null,
    taxCreditIneligible: (line as any).taxCreditIneligible ?? false,
    account: line.account
      ? {
          code: line.account.code,
          name: line.account.name,
          accountType: line.account.accountType ?? null,
        }
      : null,
        location: line.location
      ? {
          country: line.location.country,
          provinceState: line.location.provinceState ?? null,
          incentiveRegionCode: line.location.incentiveRegionCode ?? null,
        }
      : null,
  };
}

export function expenseFactToSpendRecord(fact: ExpenseFactWithRelations): SpendRecord {
  const effectivePersonId =
    fact.personId ??
    fact.vendor?.principalPersonId ??
    null;

  return {
    sourceId: fact.id,
    sourceType: EvaluationSource.ACTUAL,
    amount: fact.actualLine.amount.toString(),
    labourAmount: null,
    isLabour: fact.labourFlag,
    isService: fact.serviceFlag,
    eligiblePortion: fact.eligiblePortion.toString(),
    effectivePersonId,
    vendorId: fact.vendorId,
    locationId: fact.locationId,
    productionPhaseId: fact.productionPhaseId,
    budgetAccountId: fact.budgetAccountId ?? null,
    activityType: null,
    taxCreditIneligible: false,
    account: null,
    location: fact.location
      ? {
          country: fact.location.country,
          provinceState: fact.location.provinceState ?? null,
          incentiveRegionCode: fact.location.incentiveRegionCode ?? null,
        }
      : null,
  };
}
