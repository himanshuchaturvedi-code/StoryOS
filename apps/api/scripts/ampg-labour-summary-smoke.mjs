import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ExpenseType } from '@storyos/types';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dist = path.join(root, 'apps/api/dist/apps/api/src/document-generation');

const { mapAmpgLabourSummary } = await import(path.join(dist, 'ampg-labour-summary.mapper.js'));
const {
  renderAmpgLabourSummaryPdf,
  buildAmpgLabourSummaryPdfHeaderLines,
  buildAmpgLabourSummaryPdfSummaryRows,
} = await import(path.join(dist, 'ampg-labour-summary.renderer.js'));
const { buildAmpgLabourSummaryFileName, buildAmpgLabourSummaryDocumentTitle } = await import(
  path.join(dist, 'ampg-labour-summary-document-metadata.js')
);
const {
  buildAmpgBudgetData,
  buildBudgetLine,
  buildAlbertaResidency,
  buildOntarioResidency,
} = await import(path.join(dist, '__fixtures__/ampg-spend-summary.fixtures.js'));

const outDir = path.join(root, 'tmp/ampg-labour-summary-smoke');
fs.mkdirSync(outDir, { recursive: true });

const data = buildAmpgBudgetData(
  [
    buildBudgetLine({
      amount: 52000,
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
    buildBudgetLine({
      amount: 9000,
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
      },
      account: { code: '23.02', name: 'Payroll Services' },
    }),
    buildBudgetLine({
      amount: 7000,
      expenseType: ExpenseType.LABOUR,
      account: { code: '23.04', name: 'Unassigned Labour' },
    }),
  ],
  {
    residencies: new Map([
      buildAlbertaResidency('person-director'),
      buildOntarioResidency('person-editor'),
      buildAlbertaResidency('person-principal'),
    ]),
  },
);

const mapped = mapAmpgLabourSummary(data);
const pdf = await renderAmpgLabourSummaryPdf(mapped);
const fileName = buildAmpgLabourSummaryFileName({
  projectTitle: data.project.title,
  generatedAt: mapped.generatedAt,
});

fs.writeFileSync(path.join(outDir, fileName), pdf);

const meta = {
  fileName,
  documentTitle: buildAmpgLabourSummaryDocumentTitle({
    projectTitle: data.project.title,
  }),
  header: buildAmpgLabourSummaryPdfHeaderLines(mapped),
  summaryLabels: buildAmpgLabourSummaryPdfSummaryRows(mapped).map((row) => row[0]),
  summary: mapped.summary,
  personIndex: mapped.personIndex,
  rowCount: mapped.rows.length,
  warnings: mapped.warnings.map((warning) => warning.message),
};

fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));
console.log(JSON.stringify(meta, null, 2));
