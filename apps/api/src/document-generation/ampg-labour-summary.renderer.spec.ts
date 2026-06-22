import { ExpenseType } from '@storyos/types';
import {
  buildAlbertaResidency,
  buildAmpgBudgetData,
  buildBudgetLine,
  buildOntarioResidency,
} from './__fixtures__/ampg-spend-summary.fixtures';
import {
  buildAmpgLabourSummaryDocumentTitle,
  buildAmpgLabourSummaryFileName,
} from './ampg-labour-summary-document-metadata';
import { mapAmpgLabourSummary } from './ampg-labour-summary.mapper';
import {
  buildAmpgLabourSummaryPdfHeaderLines,
  buildAmpgLabourSummaryPdfSummaryRows,
  renderAmpgLabourSummaryPdf,
} from './ampg-labour-summary.renderer';

function pdfLooksValid(pdf: Buffer): boolean {
  return pdf.length > 1000 && pdf.subarray(0, 5).toString('ascii') === '%PDF-';
}

describe('buildAmpgLabourSummaryFileName', () => {
  it('uses the AMPG_AB_LABOUR prefix', () => {
    expect(
      buildAmpgLabourSummaryFileName({
        projectTitle: 'Alberta Pilot Production',
        generatedAt: new Date('2026-06-22T12:00:00.000Z'),
      }),
    ).toBe('AMPG_AB_LABOUR_Alberta_Pilot_Production_20260622.pdf');
  });
});

describe('renderAmpgLabourSummaryPdf', () => {
  it('renders a valid PDF with disclaimer and summary rows', async () => {
    const mapped = mapAmpgLabourSummary(
      buildAmpgBudgetData(
        [
          buildBudgetLine({
            amount: 50000,
            expenseType: ExpenseType.LABOUR,
            personId: 'person-director',
            account: { code: '05.01', name: 'Director' },
          }),
          buildBudgetLine({
            amount: 18000,
            expenseType: ExpenseType.LABOUR,
            personId: 'person-editor',
            account: { code: '45.01', name: 'Editor' },
          }),
        ],
        {
          residencies: new Map([
            buildAlbertaResidency('person-director'),
            buildOntarioResidency('person-editor'),
          ]),
        },
      ),
    );

    const pdf = await renderAmpgLabourSummaryPdf(mapped);

    expect(pdfLooksValid(pdf)).toBe(true);
    expect(buildAmpgLabourSummaryPdfHeaderLines(mapped).at(-1)).toMatch(
      /not a substitute for signed Alberta Residency Confirmation forms/i,
    );
    expect(buildAmpgLabourSummaryPdfSummaryRows(mapped).map((row) => row[0])).toEqual([
      'Total labour',
      'Alberta resident labour',
      'Non-Alberta / unknown labour',
      'Distinct Alberta resident persons',
    ]);
    expect(
      buildAmpgLabourSummaryDocumentTitle({ projectTitle: mapped.projectTitle }),
    ).toBe('AMPG Alberta Labour Summary — Alberta Pilot Production');
  });
});
