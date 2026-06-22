import { ExpenseType } from '@storyos/types';
import {
  buildAlbertaLine,
  buildAmpgBudgetData,
  buildBudgetLine,
  buildNonAlbertaLine,
} from './__fixtures__/ampg-spend-summary.fixtures';
import { isAlbertaProvince, mapAmpgSpendSummary } from './ampg-spend-summary.mapper';

describe('isAlbertaProvince', () => {
  it('accepts CA-AB and AB province codes', () => {
    expect(isAlbertaProvince('CA-AB')).toBe(true);
    expect(isAlbertaProvince('AB')).toBe(true);
    expect(isAlbertaProvince('CA-ON')).toBe(false);
    expect(isAlbertaProvince(null)).toBe(false);
  });
});

describe('mapAmpgSpendSummary', () => {
  it('includes Alberta lines and excludes non-Alberta, ineligible, and missing-location lines', () => {
    const data = buildAmpgBudgetData([
      buildAlbertaLine({
        amount: 50000,
        account: { code: '05.01', name: 'Director' },
      }),
      buildNonAlbertaLine({
        amount: 20000,
        account: { code: '05.02', name: 'Ontario Producer' },
      }),
      buildBudgetLine({
        amount: 10000,
        location: null,
        account: { code: '10.01', name: 'Unlocated Spend' },
      }),
      buildAlbertaLine({
        amount: 5000,
        taxCreditIneligible: true,
        account: { code: '99.01', name: 'Ineligible Fee' },
      }),
    ]);

    const mapped = mapAmpgSpendSummary(data);

    expect(mapped.rows).toHaveLength(1);
    expect(mapped.rows[0]?.accountCode).toBe('05.01');
    expect(mapped.summary.totalAlbertaEligibleSpend).toBe(50000);
    expect(mapped.summary.totalProductionBudget).toBe(85000);
    expect(mapped.warnings.some((warning) => /no location/i.test(warning.message))).toBe(
      true,
    );
    expect(mapped.warnings.some((warning) => /outside Alberta/i.test(warning.message))).toBe(
      true,
    );
    expect(
      mapped.warnings.some((warning) => /tax-credit-ineligible/i.test(warning.message)),
    ).toBe(true);
  });

  it('splits labour and non-labour amounts including mixed lines with labourAmount', () => {
    const data = buildAmpgBudgetData([
      buildAlbertaLine({
        amount: 40000,
        expenseType: ExpenseType.LABOUR,
        account: { code: '05.01', name: 'Director' },
      }),
      buildAlbertaLine({
        amount: 10000,
        expenseType: ExpenseType.NON_LABOUR,
        account: { code: '30.01', name: 'Equipment Rental' },
      }),
      buildAlbertaLine({
        amount: 15000,
        expenseType: ExpenseType.MIXED,
        labourAmount: 9000,
        account: { code: '40.01', name: 'Mixed Package' },
      }),
    ]);

    const mapped = mapAmpgSpendSummary(data);

    expect(mapped.summary.albertaLabourTotal).toBe(49000);
    expect(mapped.summary.albertaNonLabourTotal).toBe(16000);
    expect(mapped.summary.totalAlbertaEligibleSpend).toBe(65000);
    expect(mapped.summary.estimatedAmpgGrantBase).toBe(65000);
    expect(mapped.summary.estimatedAmpgGrantAmount).toBe(16250);
    expect(mapped.summary.albertaSpendRatio).toBe(1);
  });

  it('warns when mixed lines are missing labourAmount and counts entire amount as labour', () => {
    const data = buildAmpgBudgetData([
      buildAlbertaLine({
        amount: 12000,
        expenseType: ExpenseType.MIXED,
        labourAmount: null,
        account: { code: '40.02', name: 'Mixed Missing Split' },
      }),
    ]);

    const mapped = mapAmpgSpendSummary(data);

    expect(mapped.summary.albertaLabourTotal).toBe(12000);
    expect(mapped.summary.albertaNonLabourTotal).toBe(0);
    expect(
      mapped.warnings.some((warning) => /missing labourAmount/i.test(warning.message)),
    ).toBe(true);
  });

  it('sets document metadata fields', () => {
    const mapped = mapAmpgSpendSummary(buildAmpgBudgetData([]));

    expect(mapped.documentType).toBe('AMPG_AB_SPEND_SUMMARY');
    expect(mapped.projectTitle).toBe('Alberta Pilot Production');
    expect(mapped.budgetVersionName).toBe('Locked v1');
    expect(mapped.generatedAt).toBeInstanceOf(Date);
  });
});
