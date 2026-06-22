import { ExpenseType } from '@storyos/types';
import {
  labourAmountsEqual,
  resolveBackfillTarget,
  resolveEffectiveExpenseType,
  resolveWriteLabourAmount,
  summarizeBackfillTargets,
  syncLabourAmount,
} from './labour-amount-sync';

describe('resolveEffectiveExpenseType', () => {
  it('uses explicit expenseType when set', () => {
    expect(resolveEffectiveExpenseType(ExpenseType.MIXED, 'OTHER')).toBe(ExpenseType.MIXED);
  });

  it('defaults ATL/BTL accounts to LABOUR', () => {
    expect(resolveEffectiveExpenseType(null, 'ABOVE_THE_LINE')).toBe(ExpenseType.LABOUR);
    expect(resolveEffectiveExpenseType(null, 'BELOW_THE_LINE_PRODUCTION')).toBe(
      ExpenseType.LABOUR,
    );
    expect(resolveEffectiveExpenseType(null, 'BELOW_THE_LINE_POST')).toBe(ExpenseType.LABOUR);
  });

  it('defaults OTHER accounts to NON_LABOUR', () => {
    expect(resolveEffectiveExpenseType(null, 'OTHER')).toBe(ExpenseType.NON_LABOUR);
  });

  it('returns null for unclassified accounts', () => {
    expect(resolveEffectiveExpenseType(null, null)).toBeNull();
    expect(resolveEffectiveExpenseType(null, 'UNKNOWN')).toBeNull();
  });
});

describe('syncLabourAmount', () => {
  it('sets LABOUR to amount', () => {
    expect(
      syncLabourAmount({
        effectiveType: ExpenseType.LABOUR,
        amount: 1500,
        currentLabourAmount: null,
        trigger: 'amount_change',
      }),
    ).toBe(1500);
  });

  it('sets NON_LABOUR to zero', () => {
    expect(
      syncLabourAmount({
        effectiveType: ExpenseType.NON_LABOUR,
        amount: 1500,
        currentLabourAmount: null,
        trigger: 'expense_type_change',
      }),
    ).toBe(0);
  });

  it('clears MIXED on classification change unless explicit split provided', () => {
    expect(
      syncLabourAmount({
        effectiveType: ExpenseType.MIXED,
        amount: 1000,
        currentLabourAmount: 1500,
        trigger: 'expense_type_change',
      }),
    ).toBeNull();
    expect(
      syncLabourAmount({
        effectiveType: ExpenseType.MIXED,
        amount: 1000,
        currentLabourAmount: 1500,
        trigger: 'expense_type_change',
        explicitLabourAmount: 600,
      }),
    ).toBe(600);
  });

  it('preserves MIXED split on amount change', () => {
    expect(
      syncLabourAmount({
        effectiveType: ExpenseType.MIXED,
        amount: 1200,
        currentLabourAmount: 600,
        trigger: 'amount_change',
      }),
    ).toBe(600);
  });

  it('preserves MIXED split on clone', () => {
    expect(
      syncLabourAmount({
        effectiveType: ExpenseType.MIXED,
        amount: 1000,
        currentLabourAmount: 400,
        trigger: 'clone',
      }),
    ).toBe(400);
  });

  it('leaves unclassified labourAmount unchanged', () => {
    expect(
      syncLabourAmount({
        effectiveType: null,
        amount: 1000,
        currentLabourAmount: 250,
        trigger: 'amount_change',
      }),
    ).toBe(250);
  });
});

describe('resolveWriteLabourAmount', () => {
  it('syncs create on implicit LABOUR account', () => {
    expect(
      resolveWriteLabourAmount({
        operation: 'create',
        expenseType: null,
        accountType: 'ABOVE_THE_LINE',
        amount: 5000,
        currentLabourAmount: null,
      }),
    ).toBe(5000);
  });

  it('syncs create on implicit NON_LABOUR account', () => {
    expect(
      resolveWriteLabourAmount({
        operation: 'create',
        expenseType: null,
        accountType: 'OTHER',
        amount: 5000,
        currentLabourAmount: null,
      }),
    ).toBe(0);
  });

  it('syncs amount change for effective LABOUR', () => {
    expect(
      resolveWriteLabourAmount({
        operation: 'amount_change',
        expenseType: ExpenseType.LABOUR,
        accountType: 'OTHER',
        amount: 2200,
        currentLabourAmount: 1000,
      }),
    ).toBe(2200);
  });

  it('does not overwrite MIXED split on amount change', () => {
    expect(
      resolveWriteLabourAmount({
        operation: 'amount_change',
        expenseType: ExpenseType.MIXED,
        accountType: 'ABOVE_THE_LINE',
        amount: 2200,
        currentLabourAmount: 600,
      }),
    ).toBe(600);
  });

  it('normalizes annotate labourAmount on LABOUR lines', () => {
    expect(
      resolveWriteLabourAmount({
        operation: 'annotate',
        expenseType: ExpenseType.LABOUR,
        accountType: 'ABOVE_THE_LINE',
        amount: 1000,
        currentLabourAmount: null,
        annotateDto: { labourAmount: 750 },
      }),
    ).toBe(1000);
  });

  it('accepts annotate labourAmount on MIXED lines', () => {
    expect(
      resolveWriteLabourAmount({
        operation: 'annotate',
        expenseType: ExpenseType.MIXED,
        accountType: 'ABOVE_THE_LINE',
        amount: 1000,
        currentLabourAmount: null,
        annotateDto: { labourAmount: 600 },
      }),
    ).toBe(600);
  });

  it('returns undefined when annotate does not touch classification or labourAmount', () => {
    expect(
      resolveWriteLabourAmount({
        operation: 'annotate',
        expenseType: ExpenseType.LABOUR,
        accountType: 'ABOVE_THE_LINE',
        amount: 1000,
        currentLabourAmount: 1000,
        annotateDto: {},
      }),
    ).toBeUndefined();
  });

  it('repairs clone LABOUR lines with stale null labourAmount', () => {
    expect(
      resolveWriteLabourAmount({
        operation: 'clone',
        expenseType: ExpenseType.LABOUR,
        accountType: 'ABOVE_THE_LINE',
        amount: 3000,
        currentLabourAmount: null,
      }),
    ).toBe(3000);
  });
});

describe('backfill helpers', () => {
  it('targets LABOUR rows where labourAmount is out of sync', () => {
    const target = resolveBackfillTarget('line-1', {
      expenseType: ExpenseType.LABOUR,
      accountType: 'ABOVE_THE_LINE',
      amount: 1000,
      currentLabourAmount: null,
    });

    expect(target).toEqual({
      lineKey: 'line-1',
      currentLabourAmount: null,
      targetLabourAmount: 1000,
      effectiveType: ExpenseType.LABOUR,
    });
  });

  it('targets NON_LABOUR rows where labourAmount is not zero', () => {
    const target = resolveBackfillTarget('line-2', {
      expenseType: ExpenseType.NON_LABOUR,
      accountType: 'OTHER',
      amount: 500,
      currentLabourAmount: null,
    });

    expect(target?.targetLabourAmount).toBe(0);
  });

  it('leaves MIXED and unclassified rows unchanged', () => {
    expect(
      resolveBackfillTarget('mixed', {
        expenseType: ExpenseType.MIXED,
        accountType: 'ABOVE_THE_LINE',
        amount: 1000,
        currentLabourAmount: null,
      }),
    ).toBeNull();

    expect(
      resolveBackfillTarget('unclassified', {
        expenseType: null,
        accountType: null,
        amount: 1000,
        currentLabourAmount: null,
      }),
    ).toBeNull();
  });

  it('summarizes backfill counts', () => {
    const summary = summarizeBackfillTargets([
      {
        lineKey: 'labour',
        expenseType: ExpenseType.LABOUR,
        accountType: 'ABOVE_THE_LINE',
        amount: 1000,
        currentLabourAmount: null,
      },
      {
        lineKey: 'non-labour',
        expenseType: ExpenseType.NON_LABOUR,
        accountType: 'OTHER',
        amount: 500,
        currentLabourAmount: 100,
      },
      {
        lineKey: 'mixed',
        expenseType: ExpenseType.MIXED,
        accountType: 'ABOVE_THE_LINE',
        amount: 1000,
        currentLabourAmount: 600,
      },
      {
        lineKey: 'synced',
        expenseType: ExpenseType.LABOUR,
        accountType: 'ABOVE_THE_LINE',
        amount: 1000,
        currentLabourAmount: 1000,
      },
    ]);

    expect(summary.totalLines).toBe(4);
    expect(summary.labourUpdates).toBe(1);
    expect(summary.nonLabourUpdates).toBe(1);
    expect(summary.mixedUnchanged).toBe(1);
    expect(summary.alreadySynced).toBe(1);
  });

  it('treats decimal-equal labour amounts as already synced', () => {
    expect(labourAmountsEqual(1000, 1000.0)).toBe(true);
    expect(
      resolveBackfillTarget('line', {
        expenseType: ExpenseType.LABOUR,
        accountType: 'ABOVE_THE_LINE',
        amount: 1000,
        currentLabourAmount: 1000,
      }),
    ).toBeNull();
  });
});
