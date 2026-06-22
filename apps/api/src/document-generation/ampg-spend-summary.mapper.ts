import { ExpenseType } from '@storyos/types';
import type {
  AmpgSpendSummaryDocument,
  AmpgSpendSummaryRow,
  DocumentWarning,
} from '@storyos/types';
import { PROGRAM_SPECS } from '../grants/estimators/program-specs';
import { budgetLineToSpendRecord } from '../calculators/spend-record.projection';
import type { AmpgBudgetData } from './ampg-budget.collector';
import type { BudgetLineWithRelations } from './cptc-part-a.collector';

const AMPG_PROGRAM_CODE = 'AMPG';
const DEFAULT_AMPG_GRANT_RATE = 0.25;

export function isAlbertaProvince(provinceState: string | null | undefined): boolean {
  if (!provinceState) return false;
  return provinceState === 'CA-AB' || provinceState === 'AB';
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolvePayeeLabel(line: BudgetLineWithRelations): string | null {
  if (line.person) {
    const name = [line.person.firstName, line.person.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return name || null;
  }
  if (line.vendor?.name) {
    return line.vendor.name;
  }
  return null;
}

function resolveIsLabour(line: BudgetLineWithRelations): boolean {
  const record = budgetLineToSpendRecord(line);
  return record.isLabour;
}

function splitLabourAmounts(
  line: BudgetLineWithRelations,
  isLabour: boolean,
): { labourAmount: number; nonLabourAmount: number; mixedMissingLabourAmount: boolean } {
  const totalAmount = Number(line.amount);

  if (line.expenseType === ExpenseType.NON_LABOUR || !isLabour) {
    return { labourAmount: 0, nonLabourAmount: totalAmount, mixedMissingLabourAmount: false };
  }

  if (line.expenseType === ExpenseType.MIXED) {
    if (line.labourAmount != null) {
      const labourAmount = Number(line.labourAmount);
      return {
        labourAmount,
        nonLabourAmount: Math.max(0, totalAmount - labourAmount),
        mixedMissingLabourAmount: false,
      };
    }
    return {
      labourAmount: totalAmount,
      nonLabourAmount: 0,
      mixedMissingLabourAmount: true,
    };
  }

  return { labourAmount: totalAmount, nonLabourAmount: 0, mixedMissingLabourAmount: false };
}

function resolveAmpgGrantRate(): number {
  return PROGRAM_SPECS.get(AMPG_PROGRAM_CODE)?.baseRate ?? DEFAULT_AMPG_GRANT_RATE;
}

export function mapAmpgSpendSummary(data: AmpgBudgetData): AmpgSpendSummaryDocument {
  const warnings: DocumentWarning[] = [];
  const rows: AmpgSpendSummaryRow[] = [];

  let totalProductionBudget = 0;
  let albertaLabourTotal = 0;
  let albertaNonLabourTotal = 0;

  let missingLocationCount = 0;
  let nonAlbertaExcludedCount = 0;
  let ineligibleExcludedCount = 0;
  let mixedMissingLabourAmountCount = 0;

  for (const line of data.lines) {
    const amount = Number(line.amount);
    totalProductionBudget += amount;

    if (line.taxCreditIneligible) {
      ineligibleExcludedCount++;
      continue;
    }

    if (!line.location?.provinceState) {
      missingLocationCount++;
      continue;
    }

    if (!isAlbertaProvince(line.location.provinceState)) {
      nonAlbertaExcludedCount++;
      continue;
    }

    const isLabour = resolveIsLabour(line);
    const split = splitLabourAmounts(line, isLabour);
    if (split.mixedMissingLabourAmount) {
      mixedMissingLabourAmountCount++;
    }

    albertaLabourTotal += split.labourAmount;
    albertaNonLabourTotal += split.nonLabourAmount;

    rows.push({
      lineId: line.id,
      accountCode: line.account?.code ?? '',
      accountName: line.account?.name ?? '',
      description: line.description,
      payeeLabel: resolvePayeeLabel(line),
      provinceState: line.location.provinceState,
      labourAmount: roundMoney(split.labourAmount),
      nonLabourAmount: roundMoney(split.nonLabourAmount),
      totalAmount: roundMoney(amount),
    });
  }

  if (missingLocationCount > 0) {
    warnings.push({
      severity: 'warning',
      message: `${missingLocationCount} budget line(s) have no location — excluded from Alberta eligible spend`,
    });
  }

  if (nonAlbertaExcludedCount > 0) {
    warnings.push({
      severity: 'info',
      message: `${nonAlbertaExcludedCount} budget line(s) outside Alberta were excluded`,
    });
  }

  if (ineligibleExcludedCount > 0) {
    warnings.push({
      severity: 'info',
      message: `${ineligibleExcludedCount} tax-credit-ineligible line(s) were excluded from Alberta eligible spend`,
    });
  }

  if (mixedMissingLabourAmountCount > 0) {
    warnings.push({
      severity: 'warning',
      message: `${mixedMissingLabourAmountCount} mixed expense line(s) are missing labourAmount — entire amount counted as labour`,
    });
  }

  const totalAlbertaEligibleSpend = albertaLabourTotal + albertaNonLabourTotal;
  const albertaSpendRatio = totalProductionBudget > 0
    ? totalAlbertaEligibleSpend / totalProductionBudget
    : 0;
  const grantRate = resolveAmpgGrantRate();
  const estimatedAmpgGrantBase = roundMoney(totalAlbertaEligibleSpend);
  const estimatedAmpgGrantAmount = roundMoney(estimatedAmpgGrantBase * grantRate);

  return {
    documentType: 'AMPG_AB_SPEND_SUMMARY',
    projectTitle: data.project.title,
    budgetVersionId: data.budgetVersionId,
    budgetVersionName: data.budgetVersionName,
    rows,
    summary: {
      albertaLabourTotal: roundMoney(albertaLabourTotal),
      albertaNonLabourTotal: roundMoney(albertaNonLabourTotal),
      totalAlbertaEligibleSpend: estimatedAmpgGrantBase,
      totalProductionBudget: roundMoney(totalProductionBudget),
      albertaSpendRatio: roundMoney(albertaSpendRatio),
      estimatedAmpgGrantBase,
      estimatedAmpgGrantAmount,
    },
    warnings,
    generatedAt: new Date(),
  };
}
