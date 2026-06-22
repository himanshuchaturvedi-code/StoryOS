import { ExpenseType } from '@storyos/types';

export type LabourAmountSyncTrigger =
  | 'create'
  | 'clone'
  | 'amount_change'
  | 'expense_type_change'
  | 'labour_amount_change';

/**
 * Matches Eligibility tab defaultExpenseTypeForAccount() in budget-section.tsx.
 */
export function resolveEffectiveExpenseType(
  expenseType: string | null | undefined,
  accountType: string | null | undefined,
): ExpenseType | null {
  if (expenseType != null) return expenseType as ExpenseType;

  switch (accountType) {
    case 'ABOVE_THE_LINE':
    case 'BELOW_THE_LINE_PRODUCTION':
    case 'BELOW_THE_LINE_POST':
      return ExpenseType.LABOUR;
    case 'OTHER':
      return ExpenseType.NON_LABOUR;
    default:
      return null;
  }
}

export function labourAmountsEqual(
  a: number | null | undefined,
  b: number | null | undefined,
): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 0.005;
}

export interface SyncLabourAmountInput {
  effectiveType: ExpenseType | null;
  amount: number;
  currentLabourAmount: number | null;
  trigger: LabourAmountSyncTrigger;
  /** User-provided split when annotating MIXED, or preserved value on clone. */
  explicitLabourAmount?: number | null;
}

export function syncLabourAmount(input: SyncLabourAmountInput): number | null {
  const {
    effectiveType,
    amount,
    currentLabourAmount,
    trigger,
    explicitLabourAmount,
  } = input;

  if (effectiveType === ExpenseType.LABOUR) {
    return amount;
  }

  if (effectiveType === ExpenseType.NON_LABOUR) {
    return 0;
  }

  if (effectiveType === ExpenseType.MIXED) {
    if (trigger === 'amount_change') {
      return currentLabourAmount;
    }
    if (trigger === 'clone') {
      return currentLabourAmount;
    }
    if (trigger === 'expense_type_change') {
      return explicitLabourAmount !== undefined ? explicitLabourAmount : null;
    }
    if (trigger === 'labour_amount_change') {
      return explicitLabourAmount !== undefined ? explicitLabourAmount : currentLabourAmount;
    }
    if (trigger === 'create') {
      return explicitLabourAmount !== undefined ? explicitLabourAmount : null;
    }
    return currentLabourAmount;
  }

  // Unclassified — no automatic change.
  return currentLabourAmount;
}

export interface WriteLabourAmountContext {
  expenseType: string | null;
  accountType: string | null;
  amount: number;
  currentLabourAmount: number | null;
  operation: 'create' | 'clone' | 'amount_change' | 'annotate';
  requestedLabourAmount?: number | null;
  annotateDto?: {
    expenseType?: string | null;
    labourAmount?: number | null;
  };
}

/**
 * Returns the labourAmount to persist.
 * undefined = caller should not update labourAmount on this write.
 */
export function resolveWriteLabourAmount(
  ctx: WriteLabourAmountContext,
): number | null | undefined {
  const effectiveType = resolveEffectiveExpenseType(ctx.expenseType, ctx.accountType);

  switch (ctx.operation) {
    case 'create':
      return syncLabourAmount({
        effectiveType,
        amount: ctx.amount,
        currentLabourAmount: ctx.currentLabourAmount,
        trigger: 'create',
        explicitLabourAmount:
          effectiveType === ExpenseType.MIXED ? ctx.requestedLabourAmount : undefined,
      });

    case 'clone':
      return syncLabourAmount({
        effectiveType,
        amount: ctx.amount,
        currentLabourAmount: ctx.currentLabourAmount,
        trigger: 'clone',
      });

    case 'amount_change':
      return syncLabourAmount({
        effectiveType,
        amount: ctx.amount,
        currentLabourAmount: ctx.currentLabourAmount,
        trigger: 'amount_change',
      });

    case 'annotate': {
      const dto = ctx.annotateDto ?? {};
      const hasExpenseType = 'expenseType' in dto;
      const hasLabourAmount = 'labourAmount' in dto;
      if (!hasExpenseType && !hasLabourAmount) {
        return undefined;
      }

      const nextExpenseType = hasExpenseType
        ? (dto.expenseType ?? null)
        : ctx.expenseType;
      const nextEffectiveType = resolveEffectiveExpenseType(
        nextExpenseType,
        ctx.accountType,
      );

      if (hasExpenseType) {
        return syncLabourAmount({
          effectiveType: nextEffectiveType,
          amount: ctx.amount,
          currentLabourAmount: ctx.currentLabourAmount,
          trigger: 'expense_type_change',
          explicitLabourAmount: hasLabourAmount ? (dto.labourAmount ?? null) : undefined,
        });
      }

      return syncLabourAmount({
        effectiveType: nextEffectiveType,
        amount: ctx.amount,
        currentLabourAmount: ctx.currentLabourAmount,
        trigger: 'labour_amount_change',
        explicitLabourAmount: dto.labourAmount ?? null,
      });
    }

    default:
      return undefined;
  }
}

export interface BackfillLineInput {
  expenseType: string | null;
  accountType: string | null;
  amount: number;
  currentLabourAmount: number | null;
}

export interface BackfillTarget {
  lineKey: string;
  currentLabourAmount: number | null;
  targetLabourAmount: number | null;
  effectiveType: ExpenseType | null;
}

/**
 * Returns a backfill target when LABOUR/NON_LABOUR rows are out of sync.
 * MIXED and unclassified rows are left unchanged (returns null).
 */
export function resolveBackfillTarget(
  lineKey: string,
  line: BackfillLineInput,
): BackfillTarget | null {
  const effectiveType = resolveEffectiveExpenseType(line.expenseType, line.accountType);

  if (effectiveType !== ExpenseType.LABOUR && effectiveType !== ExpenseType.NON_LABOUR) {
    return null;
  }

  const targetLabourAmount = syncLabourAmount({
    effectiveType,
    amount: line.amount,
    currentLabourAmount: line.currentLabourAmount,
    trigger: 'create',
  });

  if (labourAmountsEqual(line.currentLabourAmount, targetLabourAmount)) {
    return null;
  }

  return {
    lineKey,
    currentLabourAmount: line.currentLabourAmount,
    targetLabourAmount,
    effectiveType,
  };
}

export interface BackfillSummary {
  totalLines: number;
  labourUpdates: number;
  nonLabourUpdates: number;
  mixedUnchanged: number;
  unclassifiedUnchanged: number;
  alreadySynced: number;
}

export function summarizeBackfillTargets(
  lines: Array<BackfillLineInput & { lineKey: string }>,
): BackfillSummary {
  const summary: BackfillSummary = {
    totalLines: lines.length,
    labourUpdates: 0,
    nonLabourUpdates: 0,
    mixedUnchanged: 0,
    unclassifiedUnchanged: 0,
    alreadySynced: 0,
  };

  for (const line of lines) {
    const effectiveType = resolveEffectiveExpenseType(line.expenseType, line.accountType);
    const target = resolveBackfillTarget(line.lineKey, line);

    if (target == null) {
      if (effectiveType === ExpenseType.MIXED) {
        summary.mixedUnchanged++;
      } else if (effectiveType == null) {
        summary.unclassifiedUnchanged++;
      } else {
        summary.alreadySynced++;
      }
      continue;
    }

    if (target.effectiveType === ExpenseType.LABOUR) {
      summary.labourUpdates++;
    } else if (target.effectiveType === ExpenseType.NON_LABOUR) {
      summary.nonLabourUpdates++;
    }
  }

  return summary;
}
