import { ExpenseType } from '@storyos/types';
import {
  buildAlbertaResidency,
  buildAmpgBudgetData,
  buildBudgetLine,
  buildOntarioResidency,
} from './__fixtures__/ampg-spend-summary.fixtures';
import { isAlbertaResident, mapAmpgLabourSummary } from './ampg-labour-summary.mapper';

describe('isAlbertaResident', () => {
  it('accepts Canadian residency with CA-AB or AB province codes', () => {
    expect(isAlbertaResident({ country: 'CA', provinceState: 'CA-AB' })).toBe(true);
    expect(isAlbertaResident({ country: 'CA', provinceState: 'AB' })).toBe(true);
    expect(isAlbertaResident({ country: 'CA', provinceState: 'CA-ON' })).toBe(false);
    expect(isAlbertaResident({ country: 'US', provinceState: 'CA-AB' })).toBe(false);
  });
});

describe('mapAmpgLabourSummary', () => {
  it('includes Alberta resident labour and excludes non-labour lines', () => {
    const data = buildAmpgBudgetData(
      [
        buildBudgetLine({
          amount: 50000,
          expenseType: ExpenseType.LABOUR,
          personId: 'person-director',
          person: { firstName: 'Jane', lastName: 'Director' } as any,
          account: { code: '05.01', name: 'Director' },
        }),
        buildBudgetLine({
          amount: 10000,
          expenseType: ExpenseType.NON_LABOUR,
          personId: 'person-director',
          account: { code: '30.01', name: 'Equipment Rental' },
        }),
        buildBudgetLine({
          amount: 20000,
          expenseType: ExpenseType.LABOUR,
          personId: 'person-producer',
          account: { code: '05.02', name: 'Producer' },
        }),
      ],
      {
        residencies: new Map([
          buildAlbertaResidency('person-director'),
          buildOntarioResidency('person-producer'),
        ]),
      },
    );

    const mapped = mapAmpgLabourSummary(data);

    expect(mapped.rows).toHaveLength(1);
    expect(mapped.rows[0]?.payeeLabel).toBeTruthy();
    expect(mapped.summary.totalLabour).toBe(70000);
    expect(mapped.summary.albertaResidentLabour).toBe(50000);
    expect(mapped.summary.nonAlbertaOrUnknownLabour).toBe(20000);
    expect(mapped.summary.distinctAlbertaResidentPersonCount).toBe(1);
    expect(
      mapped.warnings.some((warning) => /residency outside Alberta/i.test(warning.message)),
    ).toBe(true);
  });

  it('warns when labour lines have missing residency', () => {
    const data = buildAmpgBudgetData([
      buildBudgetLine({
        amount: 15000,
        expenseType: ExpenseType.LABOUR,
        personId: 'person-gaffer',
        account: { code: '23.01', name: 'Gaffer' },
      }),
    ]);

    const mapped = mapAmpgLabourSummary(data);

    expect(mapped.rows).toHaveLength(0);
    expect(mapped.summary.albertaResidentLabour).toBe(0);
    expect(mapped.summary.nonAlbertaOrUnknownLabour).toBe(15000);
    expect(
      mapped.warnings.some((warning) => /missing residency status/i.test(warning.message)),
    ).toBe(true);
  });

  it('uses vendor principal person for residency lookup and payee label', () => {
    const data = buildAmpgBudgetData(
      [
        buildBudgetLine({
          amount: 12000,
          expenseType: ExpenseType.LABOUR,
          vendorId: 'vendor-1',
          vendor: {
            id: 'vendor-1',
            name: 'Alberta Payroll Co.',
            principalPersonId: 'person-principal',
            principalPerson: {
              id: 'person-principal',
              firstName: 'Alex',
              lastName: 'Albertan',
            },
          } as any,
          account: { code: '23.02', name: 'Payroll Services' },
        }),
      ],
      {
        residencies: new Map([buildAlbertaResidency('person-principal')]),
      },
    );

    const mapped = mapAmpgLabourSummary(data);

    expect(mapped.rows).toHaveLength(1);
    expect(mapped.rows[0]?.payeeLabel).toBe('Alex Albertan');
    expect(mapped.summary.albertaResidentLabour).toBe(12000);
    expect(mapped.personIndex).toEqual([
      expect.objectContaining({
        personId: 'person-principal',
        payeeLabel: 'Alex Albertan',
        totalLabourAmount: 12000,
      }),
    ]);
  });

  it('warns for vendor labour without principal person', () => {
    const data = buildAmpgBudgetData([
      buildBudgetLine({
        amount: 9000,
        expenseType: ExpenseType.LABOUR,
        vendorId: 'vendor-2',
        vendor: {
          id: 'vendor-2',
          name: 'No Principal Vendor',
          principalPersonId: null,
          principalPerson: null,
        },
        account: { code: '23.03', name: 'Vendor Labour' },
      }),
    ]);

    const mapped = mapAmpgLabourSummary(data);

    expect(mapped.rows).toHaveLength(0);
    expect(
      mapped.warnings.some((warning) => /no principal person/i.test(warning.message)),
    ).toBe(true);
    expect(
      mapped.warnings.some((warning) => /not a substitute for signed Alberta/i.test(warning.message)),
    ).toBe(true);
  });

  it('warns when labour lines have no assigned person or vendor principal', () => {
    const data = buildAmpgBudgetData([
      buildBudgetLine({
        amount: 7000,
        expenseType: ExpenseType.LABOUR,
        account: { code: '23.04', name: 'Unassigned Labour' },
      }),
    ]);

    const mapped = mapAmpgLabourSummary(data);

    expect(
      mapped.warnings.some((warning) => /no person or vendor principal person/i.test(warning.message)),
    ).toBe(true);
  });
});
