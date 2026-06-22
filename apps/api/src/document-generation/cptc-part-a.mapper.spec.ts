import {
  classifyLine,
  computeSummary,
  mapCptcPartA,
  resolveLineAmountSplit,
} from './cptc-part-a.mapper';
import { mapCptcPartAWithRegistry, classifyForFormLine } from './cptc-part-a.mapper-v2';
import {
  buildBudgetLine,
  buildCptcPartAData,
  caCitizenResidency,
  ExpenseType,
} from './__fixtures__/cptc-part-a.fixtures';
import type { BocRow } from '@storyos/types';
import { findLineByCode, loadCptcBocRegistry } from '@storyos/program-registry';

describe('computeSummary', () => {
  it('aggregates services and post-production Canadian/non-Canadian totals', () => {
    const rows: BocRow[] = [
      {
        accountCode: '100',
        accountName: 'Production',
        keyCreativeCanadian: 100,
        keyCreativeNonCanadian: 50,
        servicesCanadian: 200,
        servicesNonCanadian: 75,
        postProductionLabCanadian: 300,
        postProductionLabNonCanadian: 100,
        otherCosts: 25,
        total: 850,
        isHeader: false,
        indent: 0,
      },
      {
        accountCode: '000',
        accountName: 'Header',
        keyCreativeCanadian: 0,
        keyCreativeNonCanadian: 0,
        servicesCanadian: 0,
        servicesNonCanadian: 0,
        postProductionLabCanadian: 0,
        postProductionLabNonCanadian: 0,
        otherCosts: 0,
        total: 0,
        isHeader: true,
        indent: 0,
      },
    ];

    const summary = computeSummary(rows);

    expect(summary.totalCostOfProduction).toBe(850);
    expect(summary.totalServicesCanadian).toBe(100);
    expect(summary.totalServicesNonCanadian).toBe(50);
    expect(summary.totalServices).toBe(150);
    expect(summary.servicesCanadianRatio).toBeCloseTo(100 / 150);
    expect(summary.totalPostLabCanadian).toBe(300);
    expect(summary.totalPostLabNonCanadian).toBe(100);
    expect(summary.totalPostLab).toBe(400);
    expect(summary.postLabCanadianRatio).toBeCloseTo(0.75);
  });
});

describe('post-production classification', () => {
  it('splits Canadian post-production into postProductionLabCanadian', () => {
    const line = buildBudgetLine({
      amount: 5000,
      account: { accountType: 'BELOW_THE_LINE_POST', code: 'POST' },
      location: { country: 'CA' },
    });

    expect(classifyLine(line, new Map())).toBe('postProductionLabCanadian');
  });

  it('splits non-Canadian post-production into postProductionLabNonCanadian', () => {
    const line = buildBudgetLine({
      amount: 4000,
      account: { accountType: 'BELOW_THE_LINE_POST', code: 'POST' },
      location: { country: 'US' },
    });

    expect(classifyLine(line, new Map())).toBe('postProductionLabNonCanadian');
  });

  it('maps post-production summary totals from mapped document', () => {
    const canPost = buildBudgetLine({
      amount: 6000,
      account: {
        accountType: 'BELOW_THE_LINE_POST',
        code: 'POST-CA',
        sortOrder: 1,
      },
      location: { country: 'CA' },
    });
    const nonCanPost = buildBudgetLine({
      amount: 2000,
      account: {
        accountType: 'BELOW_THE_LINE_POST',
        code: 'POST-US',
        sortOrder: 2,
        id: 'acct-2',
      },
      budgetAccountId: 'acct-2',
      location: { country: 'US' },
    });

    const doc = mapCptcPartA(buildCptcPartAData([canPost, nonCanPost]));

    expect(doc.summary.totalPostLabCanadian).toBe(6000);
    expect(doc.summary.totalPostLabNonCanadian).toBe(2000);
    expect(doc.summary.totalPostLab).toBe(8000);
    expect(doc.summary.postLabCanadianRatio).toBeCloseTo(0.75);
  });
});

describe('taxCreditIneligible handling', () => {
  it('excludes ineligible lines from rows and summary totals', () => {
    const eligible = buildBudgetLine({
      amount: 1000,
      account: { code: 'ELIG', sortOrder: 1 },
      location: { country: 'CA' },
    });
    const ineligible = buildBudgetLine({
      amount: 500,
      taxCreditIneligible: true,
      account: { code: 'INELIG', sortOrder: 2, id: 'acct-inelig' },
      budgetAccountId: 'acct-inelig',
      location: { country: 'CA' },
    });

    const doc = mapCptcPartA(buildCptcPartAData([eligible, ineligible]));

    expect(doc.summary.totalCostOfProduction).toBe(1000);
    expect(doc.warnings.some((w) => w.message.includes('tax-credit ineligible'))).toBe(
      true,
    );
    expect(doc.rows.find((r) => r.accountCode === 'INELIG')).toBeUndefined();
  });
});

describe('resolveLineAmountSplit', () => {
  it('places MIXED non-labour remainder in otherCostsAmount', () => {
    const line = buildBudgetLine({
      amount: 1000,
      expenseType: ExpenseType.MIXED,
      labourAmount: 600,
    });

    expect(resolveLineAmountSplit(line)).toEqual({
      classifiableAmount: 600,
      otherCostsAmount: 400,
      warnings: [],
    });
  });

  it('uses labourAmount for LABOUR expense type when set', () => {
    const line = buildBudgetLine({
      amount: 1000,
      expenseType: ExpenseType.LABOUR,
      labourAmount: 900,
    });

    expect(resolveLineAmountSplit(line).classifiableAmount).toBe(900);
  });
});

describe('mapCptcPartA integration (legacy account mapper)', () => {
  it('classifies key creative with residency into Canadian services subtotal', () => {
    const personId = 'person-director';
    const line = buildBudgetLine({
      amount: 2500,
      personId,
      account: {
        code: 'DIR',
        roleMappings: [{ programCode: 'CPTC', roleCode: 'DIRECTOR' } as never],
      },
    });

    const doc = mapCptcPartA(buildCptcPartAData([line], caCitizenResidency(personId)));

    expect(doc.summary.totalServicesCanadian).toBe(2500);
    expect(doc.rows[0]?.keyCreativeCanadian).toBe(2500);
  });
});

describe('mapCptcPartAWithRegistry (Slice 4C)', () => {
  it('aggregates Telefilm accounts into 01F21 form line codes', () => {
    const line = buildBudgetLine({
      amount: 1500,
      account: { code: '02.01', name: 'Writer(s)', sortOrder: 1 },
      personId: 'person-writer',
    });

    const doc = mapCptcPartAWithRegistry(
      buildCptcPartAData([line], caCitizenResidency('person-writer')),
    );

    const screenwriterRow = doc.rows.find((row) => row.accountCode === '2.0.a');
    expect(screenwriterRow?.keyCreativeCanadian).toBe(1500);
    expect(doc.rows.some((row) => row.accountCode === '02.01')).toBe(false);
  });

  it('computes 11.1 Total Services from Key Creative columns only', () => {
    const director = buildBudgetLine({
      amount: 1000,
      personId: 'person-director',
      account: {
        code: '05.01',
        name: 'Director',
        sortOrder: 1,
        roleMappings: [{ programCode: 'CPTC', roleCode: 'DIRECTOR' } as never],
      },
    });
    const grip = buildBudgetLine({
      amount: 500,
      budgetAccountId: 'acct-grip',
      account: {
        id: 'acct-grip',
        code: '24.01',
        name: 'Grip',
        sortOrder: 2,
      },
      location: { country: 'CA' },
    });

    const doc = mapCptcPartAWithRegistry(
      buildCptcPartAData([director, grip], caCitizenResidency('person-director')),
    );

    expect(doc.summary.totalServicesCanadian).toBe(1000);
    expect(doc.summary.totalServices).toBe(1000);
    expect(doc.rows.find((row) => row.accountCode === '7.5')?.servicesCanadian).toBe(
      500,
    );
  });
});

describe('mapCptcPartAWithRegistry (Slice 4D rollups & column families)', () => {
  const registry = loadCptcBocRegistry();

  it('rolls fringe benefits into parent remuneration lines with audit trace', () => {
    const rem = buildBudgetLine({
      amount: 2000,
      account: { code: '02.01', name: 'Writer(s)', sortOrder: 1 },
      personId: 'person-writer',
    });
    const fringe = buildBudgetLine({
      amount: 400,
      budgetAccountId: 'acct-fringe',
      account: { id: 'acct-fringe', code: '02.90', name: 'Fringe', sortOrder: 2 },
      personId: 'person-writer',
    });

    const doc = mapCptcPartAWithRegistry(
      buildCptcPartAData([rem, fringe], caCitizenResidency('person-writer')),
    );

    const screenwriterRow = doc.rows.find((row) => row.accountCode === '2.0.a');
    expect(screenwriterRow?.keyCreativeCanadian).toBe(2400);
    expect(screenwriterRow?.servicesCanadian).toBe(0);
    expect(doc.rows.some((row) => row.accountCode === '02.90')).toBe(false);
    expect(doc.allocationTrace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountCode: '02.90',
          formLineCode: '2.0.a',
          rollupKind: 'fringe',
          column: 'keyCreativeCanadian',
          amount: 400,
        }),
      ]),
    );
  });

  it('places travel accounts on KC travel sub-lines instead of Services', () => {
    const travel = buildBudgetLine({
      amount: 750,
      account: { code: '05.60', name: 'Director travel', sortOrder: 1 },
      personId: 'person-director',
    });

    const doc = mapCptcPartAWithRegistry(
      buildCptcPartAData([travel], caCitizenResidency('person-director')),
    );

    const travelRow = doc.rows.find((row) => row.accountCode === '5.0.b');
    expect(travelRow?.keyCreativeCanadian).toBe(750);
    expect(travelRow?.servicesCanadian).toBe(0);
    expect(doc.allocationTrace?.[0]).toMatchObject({
      accountCode: '05.60',
      formLineCode: '5.0.b',
      rollupKind: 'travel',
      column: 'keyCreativeCanadian',
    });
  });

  it('uses producer column families for section 4.x placement', () => {
    const producerRem = buildBudgetLine({
      amount: 3000,
      account: { code: '04.05', name: 'Producer', sortOrder: 1 },
      personId: 'person-producer',
    });
    const producerTravel = buildBudgetLine({
      amount: 500,
      budgetAccountId: 'acct-travel',
      account: { id: 'acct-travel', code: '04.60', name: 'Producer travel', sortOrder: 2 },
      personId: 'person-producer',
    });
    const execRem = buildBudgetLine({
      amount: 1200,
      budgetAccountId: 'acct-exec',
      account: { id: 'acct-exec', code: '04.01', name: 'Executive producer', sortOrder: 3 },
      personId: 'person-exec',
    });

    const residencies = new Map([
      ['person-producer', { residencyType: 'CITIZEN', country: 'CA' }],
      ['person-exec', { residencyType: 'CITIZEN', country: 'CA' }],
    ]);

    const doc = mapCptcPartAWithRegistry(
      buildCptcPartAData([producerRem, producerTravel, execRem], residencies),
    );

    expect(doc.rows.find((row) => row.accountCode === '4.0.a')).toMatchObject({
      keyCreativeCanadian: 3000,
      servicesCanadian: 0,
    });
    expect(doc.rows.find((row) => row.accountCode === '4.0.b')).toMatchObject({
      keyCreativeCanadian: 500,
      servicesCanadian: 0,
    });
    expect(doc.rows.find((row) => row.accountCode === '4.3.a')).toMatchObject({
      keyCreativeCanadian: 0,
      servicesCanadian: 1200,
    });
  });

  it('preserves document totals when fringe is rolled into remuneration', () => {
    const rem = buildBudgetLine({
      amount: 1000,
      account: { code: '05.01', name: 'Director', sortOrder: 1 },
      personId: 'person-director',
    });
    const fringe = buildBudgetLine({
      amount: 200,
      budgetAccountId: 'acct-fringe',
      account: { id: 'acct-fringe', code: '05.90', name: 'Director fringe', sortOrder: 2 },
      personId: 'person-director',
    });

    const doc = mapCptcPartAWithRegistry(
      buildCptcPartAData([rem, fringe], caCitizenResidency('person-director')),
    );

    expect(doc.summary.totalCostOfProduction).toBe(1200);
    expect(doc.rows.find((row) => row.accountCode === '5.0.a')?.total).toBe(1200);
  });

  it('classifyForFormLine prefers form rules over CPTC role inference for producers', () => {
    const line = buildBudgetLine({
      amount: 1000,
      personId: 'person-producer',
      account: {
        code: '04.05',
        roleMappings: [{ programCode: 'CPTC', roleCode: 'DIRECTOR' } as never],
      },
    });
    const formLine = findLineByCode(registry, '4.0.a')!;

    expect(classifyForFormLine(line, caCitizenResidency('person-producer'), formLine)).toBe(
      'keyCreativeCanadian',
    );
  });
});
