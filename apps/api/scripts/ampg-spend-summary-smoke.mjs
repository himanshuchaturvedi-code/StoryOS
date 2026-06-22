import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ExpenseType } from '@storyos/types';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dist = path.join(root, 'apps/api/dist/apps/api/src/document-generation');

const { mapAmpgSpendSummary } = await import(path.join(dist, 'ampg-spend-summary.mapper.js'));
const {
  renderAmpgSpendSummaryPdf,
  buildAmpgSpendSummaryPdfHeaderLines,
  buildAmpgSpendSummaryPdfSummaryRows,
} = await import(path.join(dist, 'ampg-spend-summary.renderer.js'));
const { buildAmpgSpendSummaryFileName, buildAmpgSpendSummaryDocumentTitle } = await import(
  path.join(dist, 'ampg-spend-summary-document-metadata.js')
);
const {
  buildAmpgBudgetData,
  buildAlbertaLine,
  buildNonAlbertaLine,
  buildBudgetLine,
} = await import(path.join(dist, '__fixtures__/ampg-spend-summary.fixtures.js'));

const outDir = path.join(root, 'tmp/ampg-spend-summary-smoke');
fs.mkdirSync(outDir, { recursive: true });

const data = buildAmpgBudgetData([
  buildAlbertaLine({
    amount: 52000,
    expenseType: ExpenseType.LABOUR,
    account: { code: '05.01', name: 'Director' },
    personId: 'person-director',
  }),
  buildAlbertaLine({
    amount: 18000,
    expenseType: ExpenseType.NON_LABOUR,
    account: { code: '30.01', name: 'Camera Package' },
  }),
  buildNonAlbertaLine({
    amount: 12000,
    account: { code: '05.02', name: 'Ontario Producer' },
  }),
  buildBudgetLine({
    amount: 8000,
    location: null,
    account: { code: '10.01', name: 'Unlocated Spend' },
  }),
]);

const mapped = mapAmpgSpendSummary(data);
const pdf = await renderAmpgSpendSummaryPdf(mapped);
const fileName = buildAmpgSpendSummaryFileName({
  projectTitle: data.project.title,
  generatedAt: mapped.generatedAt,
});

fs.writeFileSync(path.join(outDir, fileName), pdf);

const meta = {
  fileName,
  documentTitle: buildAmpgSpendSummaryDocumentTitle({
    projectTitle: data.project.title,
  }),
  header: buildAmpgSpendSummaryPdfHeaderLines(mapped),
  summaryLabels: buildAmpgSpendSummaryPdfSummaryRows(mapped).map((row) => row[1]),
  summary: mapped.summary,
  rowCount: mapped.rows.length,
  warnings: mapped.warnings.map((warning) => warning.message),
};

fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));
console.log(JSON.stringify(meta, null, 2));
