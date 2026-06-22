import { ExpenseType } from '@storyos/types';
import {
  buildAlbertaLine,
  buildAmpgBudgetData,
  buildNonAlbertaLine,
} from './__fixtures__/ampg-spend-summary.fixtures';
import {
  buildAmpgSpendSummaryFileName,
  buildAmpgSpendSummaryDocumentTitle,
} from './ampg-spend-summary-document-metadata';
import { mapAmpgSpendSummary } from './ampg-spend-summary.mapper';
import {
  buildAmpgSpendSummaryPdfHeaderLines,
  buildAmpgSpendSummaryPdfSummaryRows,
  renderAmpgSpendSummaryPdf,
} from './ampg-spend-summary.renderer';

function pdfLooksValid(pdf: Buffer): boolean {
  return pdf.length > 1000 && pdf.subarray(0, 5).toString('ascii') === '%PDF-';
}

describe('buildAmpgSpendSummaryFileName', () => {
  it('uses the AMPG_AB_SPEND prefix', () => {
    expect(
      buildAmpgSpendSummaryFileName({
        projectTitle: 'Alberta Pilot Production',
        generatedAt: new Date('2026-06-21T12:00:00.000Z'),
      }),
    ).toBe('AMPG_AB_SPEND_Alberta_Pilot_Production_20260621.pdf');
  });
});

describe('buildAmpgSpendSummaryDocumentTitle', () => {
  it('identifies the AMPG Alberta Spend Summary in the stored title', () => {
    expect(
      buildAmpgSpendSummaryDocumentTitle({
        projectTitle: 'Alberta Pilot Production',
      }),
    ).toBe('AMPG Alberta Spend Summary — Alberta Pilot Production');
  });
});

describe('renderAmpgSpendSummaryPdf', () => {
  it('renders a valid PDF for mixed Alberta and non-Alberta spend', async () => {
    const mapped = mapAmpgSpendSummary(
      buildAmpgBudgetData([
        buildAlbertaLine({
          amount: 50000,
          account: { code: '05.01', name: 'Director' },
        }),
        buildNonAlbertaLine({
          amount: 15000,
          account: { code: '05.02', name: 'Ontario Line Producer' },
        }),
        buildAlbertaLine({
          amount: 10000,
          expenseType: ExpenseType.NON_LABOUR,
          account: { code: '30.01', name: 'Equipment Rental' },
        }),
      ]),
    );

    const pdf = await renderAmpgSpendSummaryPdf(mapped);

    expect(pdfLooksValid(pdf)).toBe(true);
    expect(buildAmpgSpendSummaryPdfHeaderLines(mapped)[0]).toBe('ALBERTA SPEND SUMMARY');
    expect(buildAmpgSpendSummaryPdfSummaryRows(mapped).map((row) => row[1])).toEqual([
      'Alberta labour total',
      'Alberta non-labour total',
      'Total Alberta eligible spend',
      'Total production budget',
      'Alberta spend ratio',
      'Estimated AMPG grant base',
      'Estimated AMPG grant (25%)',
    ]);
  });
});
