import { ExpenseType } from '@storyos/types';
import { budgetLineToSpendRecord } from '../calculators/spend-record.projection';
import type { BudgetLineWithRelations } from './cptc-part-a.collector';

export function isAlbertaProvince(provinceState: string | null | undefined): boolean {
  if (!provinceState) return false;
  return provinceState === 'CA-AB' || provinceState === 'AB';
}

export function isAlbertaResident(args: {
  country: string;
  provinceState: string | null | undefined;
}): boolean {
  return args.country === 'CA' && isAlbertaProvince(args.provinceState);
}

export function resolveIsLabourLine(line: BudgetLineWithRelations): boolean {
  return budgetLineToSpendRecord(line).isLabour;
}

export function resolveLabourLineAmount(line: BudgetLineWithRelations): number {
  const isLabour = resolveIsLabourLine(line);
  if (!isLabour) return 0;

  const totalAmount = Number(line.amount);
  if (line.expenseType === ExpenseType.NON_LABOUR) return 0;
  if (line.expenseType === ExpenseType.MIXED && line.labourAmount != null) {
    return Number(line.labourAmount);
  }
  return totalAmount;
}

export function resolveEffectivePersonId(
  line: BudgetLineWithRelations,
): string | null {
  return line.personId ?? line.vendor?.principalPersonId ?? null;
}

export function resolveLabourPayeeLabel(line: BudgetLineWithRelations): string | null {
  if (line.person) {
    const name = [line.person.firstName, line.person.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (name) return name;
  }

  const principal = line.vendor?.principalPerson;
  if (principal) {
    const name = [principal.firstName, principal.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (name) return name;
  }

  if (line.vendor?.name) {
    return line.vendor.name;
  }

  return null;
}
