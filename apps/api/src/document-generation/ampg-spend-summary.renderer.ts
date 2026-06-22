import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { AmpgSpendSummaryDocument } from '@storyos/types';
import { sanitizePdfText } from './pdf.renderer';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 40;
const ROW_HEIGHT = 14;
const HEADER_HEIGHT = 28;
const FONT_SIZE = 7;
const HEADER_FONT_SIZE = 7;
const TITLE_FONT_SIZE = 12;

const COL_WIDTHS = {
  code: 40,
  account: 120,
  payee: 90,
  province: 45,
  labour: 55,
  nonLabour: 55,
  total: 55,
};

const COLUMNS = [
  { key: 'code' as const, label: 'Acct #', width: COL_WIDTHS.code },
  { key: 'account' as const, label: 'Account', width: COL_WIDTHS.account },
  { key: 'payee' as const, label: 'Payee', width: COL_WIDTHS.payee },
  { key: 'province' as const, label: 'Prov.', width: COL_WIDTHS.province },
  { key: 'labour' as const, label: 'Labour', width: COL_WIDTHS.labour },
  { key: 'nonLabour' as const, label: 'Non-Labour', width: COL_WIDTHS.nonLabour },
  { key: 'total' as const, label: 'Total', width: COL_WIDTHS.total },
];

function fmt(n: number): string {
  if (n === 0) return '';
  return n.toLocaleString('en-CA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function pct(n: number): string {
  return (n * 100).toFixed(1) + '%';
}

export function buildAmpgSpendSummaryPdfHeaderLines(doc: AmpgSpendSummaryDocument): string[] {
  return [
    'ALBERTA SPEND SUMMARY',
    'Alberta Made Production Grant (AMPG)',
    `Production: ${doc.projectTitle}`,
    `Budget: ${doc.budgetVersionName} (LOCKED)`,
    `Generated: ${doc.generatedAt.toISOString().slice(0, 10)}`,
  ];
}

export function buildAmpgSpendSummaryPdfSummaryRows(
  doc: AmpgSpendSummaryDocument,
): string[][] {
  const { summary } = doc;
  return [
    ['', 'Alberta labour total', '', '', fmt(summary.albertaLabourTotal), '', ''],
    ['', 'Alberta non-labour total', '', '', '', fmt(summary.albertaNonLabourTotal), ''],
    ['', 'Total Alberta eligible spend', '', '', '', '', fmt(summary.totalAlbertaEligibleSpend)],
    ['', 'Total production budget', '', '', '', '', fmt(summary.totalProductionBudget)],
    ['', 'Alberta spend ratio', '', pct(summary.albertaSpendRatio), '', '', ''],
    ['', 'Estimated AMPG grant base', '', '', '', '', fmt(summary.estimatedAmpgGrantBase)],
    ['', 'Estimated AMPG grant (25%)', '', '', '', '', fmt(summary.estimatedAmpgGrantAmount)],
  ];
}

function rowValues(row: AmpgSpendSummaryDocument['rows'][number]): string[] {
  return [
    row.accountCode,
    row.accountName,
    row.payeeLabel ?? '',
    row.provinceState ?? '',
    fmt(row.labourAmount),
    fmt(row.nonLabourAmount),
    fmt(row.totalAmount),
  ];
}

export async function renderAmpgSpendSummaryPdf(
  doc: AmpgSpendSummaryDocument,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0, 0, 0);
  const headerBg = rgb(0.9, 0.9, 0.9);
  const lightBg = rgb(0.96, 0.96, 0.96);
  const borderColor = rgb(0.7, 0.7, 0.7);

  const tableWidth = COLUMNS.reduce((sum, column) => sum + column.width, 0);
  const startX = MARGIN;

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const headerLines = buildAmpgSpendSummaryPdfHeaderLines(doc);
  for (let i = 0; i < headerLines.length; i++) {
    const line = headerLines[i]!;
    page.drawText(sanitizePdfText(line), {
      x: startX,
      y,
      size: i === 0 ? TITLE_FONT_SIZE : i === 2 ? 9 : 7,
      font: i <= 1 ? boldFont : font,
      color: i >= headerLines.length - 2 && i > 2 ? rgb(0.4, 0.4, 0.4) : black,
    });
    y -= i === 0 ? 16 : i === 2 ? 12 : 11;
  }
  y -= 8;

  const drawTableHeader = () => {
    const headerTop = y;
    page.drawRectangle({
      x: startX,
      y: headerTop - HEADER_HEIGHT,
      width: tableWidth,
      height: HEADER_HEIGHT,
      color: headerBg,
      borderColor,
      borderWidth: 0.5,
    });

    let colX = startX;
    for (const col of COLUMNS) {
      page.drawText(sanitizePdfText(col.label), {
        x: colX + 3,
        y: headerTop - 18,
        size: HEADER_FONT_SIZE,
        font: boldFont,
        color: black,
      });
      colX += col.width;

      page.drawLine({
        start: { x: colX, y: headerTop },
        end: { x: colX, y: headerTop - HEADER_HEIGHT },
        thickness: 0.5,
        color: borderColor,
      });
    }

    y = headerTop - HEADER_HEIGHT;
  };

  drawTableHeader();

  const drawRow = (values: string[], isBold: boolean, bg?: typeof lightBg) => {
    if (y - ROW_HEIGHT < MARGIN + 120) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
      drawTableHeader();
    }

    if (bg) {
      page.drawRectangle({
        x: startX,
        y: y - ROW_HEIGHT,
        width: tableWidth,
        height: ROW_HEIGHT,
        color: bg,
      });
    }

    page.drawLine({
      start: { x: startX, y: y - ROW_HEIGHT },
      end: { x: startX + tableWidth, y: y - ROW_HEIGHT },
      thickness: 0.3,
      color: borderColor,
    });

    let cx = startX;
    const rowFont = isBold ? boldFont : font;
    for (let i = 0; i < COLUMNS.length; i++) {
      const col = COLUMNS[i]!;
      const val = sanitizePdfText(values[i] ?? '');
      const isNumeric = i >= 4;
      const textWidth = rowFont.widthOfTextAtSize(val, FONT_SIZE);
      const textX = isNumeric ? cx + col.width - textWidth - 3 : cx + 3;

      page.drawText(val, {
        x: textX,
        y: y - ROW_HEIGHT + 4,
        size: FONT_SIZE,
        font: rowFont,
        color: black,
      });
      cx += col.width;
    }

    y -= ROW_HEIGHT;
  };

  for (const row of doc.rows) {
    drawRow(rowValues(row), false);
  }

  y -= 6;
  for (const summaryRow of buildAmpgSpendSummaryPdfSummaryRows(doc)) {
    drawRow(summaryRow, true, headerBg);
  }

  if (doc.warnings.length > 0) {
    y -= 16;
    if (y < MARGIN + 60) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }

    page.drawText('Warnings:', {
      x: startX,
      y,
      size: 8,
      font: boldFont,
      color: rgb(0.8, 0.2, 0),
    });
    y -= 12;

    for (const warning of doc.warnings) {
      if (y < MARGIN) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }
      page.drawText(sanitizePdfText(`• ${warning.message}`), {
        x: startX + 4,
        y,
        size: 7,
        font,
        color: rgb(0.5, 0.1, 0),
        maxWidth: tableWidth - 8,
      });
      y -= 10;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
