import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from 'pdf-lib';
import type { AmpgLabourSummaryDocument } from '@storyos/types';
import { AMPG_LABOUR_SUMMARY_DISCLAIMER } from './ampg-labour-summary-document-metadata';
import { sanitizePdfText } from './pdf.renderer';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 40;
const ROW_HEIGHT = 14;
const HEADER_HEIGHT = 28;
const FONT_SIZE = 7;
const HEADER_FONT_SIZE = 7;
const TITLE_FONT_SIZE = 12;

const DETAIL_COLUMNS = [
  { label: 'Acct #', width: 40 },
  { label: 'Account', width: 105 },
  { label: 'Payee', width: 95 },
  { label: 'Residency', width: 55 },
  { label: 'Labour', width: 55 },
];

const PERSON_COLUMNS = [
  { label: 'Payee', width: 180 },
  { label: 'Total Labour', width: 70 },
];

function fmt(n: number): string {
  if (n === 0) return '';
  return n.toLocaleString('en-CA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function residencyLabel(country: string | null, province: string | null): string {
  if (!country) return '';
  if (province) return `${country} / ${province}`;
  return country;
}

export function buildAmpgLabourSummaryPdfHeaderLines(
  doc: AmpgLabourSummaryDocument,
): string[] {
  return [
    'ALBERTA LABOUR SUMMARY',
    'Alberta Made Production Grant (AMPG)',
    `Production: ${doc.projectTitle}`,
    `Budget: ${doc.budgetVersionName} (LOCKED)`,
    `Generated: ${doc.generatedAt.toISOString().slice(0, 10)}`,
    AMPG_LABOUR_SUMMARY_DISCLAIMER,
  ];
}

export function buildAmpgLabourSummaryPdfSummaryRows(
  doc: AmpgLabourSummaryDocument,
): string[][] {
  const { summary } = doc;
  return [
    ['Total labour', fmt(summary.totalLabour)],
    ['Alberta resident labour', fmt(summary.albertaResidentLabour)],
    ['Non-Alberta / unknown labour', fmt(summary.nonAlbertaOrUnknownLabour)],
    ['Distinct Alberta resident persons', String(summary.distinctAlbertaResidentPersonCount)],
  ];
}

type TableContext = {
  pdfDoc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  boldFont: PDFFont;
};

export async function renderAmpgLabourSummaryPdf(
  doc: AmpgLabourSummaryDocument,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0, 0, 0);
  const disclaimerColor = rgb(0.45, 0.1, 0.1);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const headerLines = buildAmpgLabourSummaryPdfHeaderLines(doc);
  for (let i = 0; i < headerLines.length; i++) {
    const line = headerLines[i]!;
    const isDisclaimer = i === headerLines.length - 1;
    page.drawText(sanitizePdfText(line), {
      x: MARGIN,
      y,
      size: i === 0 ? TITLE_FONT_SIZE : isDisclaimer ? 6.5 : i === 2 ? 9 : 7,
      font: i <= 1 ? boldFont : font,
      color: isDisclaimer ? disclaimerColor : i >= headerLines.length - 3 && i > 2 && !isDisclaimer ? rgb(0.4, 0.4, 0.4) : black,
      maxWidth: PAGE_WIDTH - MARGIN * 2,
    });
    y -= i === 0 ? 16 : isDisclaimer ? 18 : i === 2 ? 12 : 11;
  }
  y -= 8;

  let ctx: TableContext = { pdfDoc, page, y, font, boldFont };

  ctx = drawSectionTitle(ctx, 'Alberta Resident Labour Detail');
  ctx = drawTable(
    ctx,
    DETAIL_COLUMNS,
    doc.rows.map((row) => [
      row.accountCode,
      row.accountName,
      row.payeeLabel ?? '',
      residencyLabel(row.residencyCountry, row.residencyProvince),
      fmt(row.labourAmount),
    ]),
  );

  ctx.y -= 10;
  ctx = drawSectionTitle(ctx, 'Alberta Resident Person Index');
  ctx = drawTable(
    ctx,
    PERSON_COLUMNS,
    doc.personIndex.map((entry) => [entry.payeeLabel, fmt(entry.totalLabourAmount)]),
  );

  ctx.y -= 10;
  ctx = drawSectionTitle(ctx, 'Summary');
  ctx = drawKeyValueRows(ctx, buildAmpgLabourSummaryPdfSummaryRows(doc));

  if (doc.warnings.length > 0) {
    ctx.y -= 16;
    if (ctx.y < MARGIN + 60) {
      ctx.page = ctx.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      ctx.y = PAGE_HEIGHT - MARGIN;
    }

    ctx.page.drawText('Warnings:', {
      x: MARGIN,
      y: ctx.y,
      size: 8,
      font: boldFont,
      color: rgb(0.8, 0.2, 0),
    });
    ctx.y -= 12;

    for (const warning of doc.warnings) {
      if (ctx.y < MARGIN) {
        ctx.page = ctx.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        ctx.y = PAGE_HEIGHT - MARGIN;
      }
      ctx.page.drawText(sanitizePdfText(`• ${warning.message}`), {
        x: MARGIN + 4,
        y: ctx.y,
        size: 7,
        font,
        color: rgb(0.5, 0.1, 0),
        maxWidth: PAGE_WIDTH - MARGIN * 2 - 4,
      });
      ctx.y -= 10;
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function drawSectionTitle(ctx: TableContext, title: string): TableContext {
  ctx.page.drawText(sanitizePdfText(title), {
    x: MARGIN,
    y: ctx.y,
    size: 8,
    font: ctx.boldFont,
    color: rgb(0, 0, 0),
  });
  return { ...ctx, y: ctx.y - 14 };
}

function drawTable(
  ctx: TableContext,
  columns: Array<{ label: string; width: number }>,
  rows: string[][],
): TableContext {
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const borderColor = rgb(0.7, 0.7, 0.7);
  let { pdfDoc, page, y, font, boldFont } = ctx;

  const drawHeader = () => {
    const headerTop = y;
    page.drawRectangle({
      x: MARGIN,
      y: headerTop - HEADER_HEIGHT,
      width: tableWidth,
      height: HEADER_HEIGHT,
      color: rgb(0.9, 0.9, 0.9),
      borderColor,
      borderWidth: 0.5,
    });

    let colX = MARGIN;
    for (const column of columns) {
      page.drawText(sanitizePdfText(column.label), {
        x: colX + 3,
        y: headerTop - 18,
        size: HEADER_FONT_SIZE,
        font: boldFont,
        color: rgb(0, 0, 0),
      });
      colX += column.width;
    }

    y = headerTop - HEADER_HEIGHT;
  };

  drawHeader();

  for (const values of rows) {
    if (y - ROW_HEIGHT < MARGIN + 80) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
      drawHeader();
    }

    page.drawLine({
      start: { x: MARGIN, y: y - ROW_HEIGHT },
      end: { x: MARGIN + tableWidth, y: y - ROW_HEIGHT },
      thickness: 0.3,
      color: borderColor,
    });

    let colX = MARGIN;
    for (let i = 0; i < columns.length; i++) {
      const column = columns[i]!;
      const val = sanitizePdfText(values[i] ?? '');
      const isNumeric = i === columns.length - 1;
      const textWidth = font.widthOfTextAtSize(val, FONT_SIZE);
      const textX = isNumeric ? colX + column.width - textWidth - 3 : colX + 3;

      page.drawText(val, {
        x: textX,
        y: y - ROW_HEIGHT + 4,
        size: FONT_SIZE,
        font,
        color: rgb(0, 0, 0),
      });
      colX += column.width;
    }

    y -= ROW_HEIGHT;
  }

  return { pdfDoc, page, y, font, boldFont };
}

function drawKeyValueRows(ctx: TableContext, rows: string[][]): TableContext {
  let { page, y, font, boldFont } = ctx;

  for (const [label, value] of rows) {
    const safeLabel = label ?? '';
    const safeValue = value ?? '';
    page.drawText(sanitizePdfText(safeLabel), {
      x: MARGIN,
      y,
      size: FONT_SIZE,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    const textWidth = font.widthOfTextAtSize(sanitizePdfText(safeValue), FONT_SIZE);
    page.drawText(sanitizePdfText(safeValue), {
      x: PAGE_WIDTH - MARGIN - textWidth,
      y,
      size: FONT_SIZE,
      font,
      color: rgb(0, 0, 0),
    });
    y -= ROW_HEIGHT;
  }

  return { ...ctx, y };
}
