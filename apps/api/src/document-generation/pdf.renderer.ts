import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type {
  BocSummary,
  BocSummaryLineDefinition,
  CptcPartADocument,
  BocRow,
} from '@storyos/types';

const PAGE_WIDTH = 842; // A4 landscape
const PAGE_HEIGHT = 595;
const MARGIN = 30;
const ROW_HEIGHT = 14;
const HEADER_HEIGHT = 40;
const FONT_SIZE = 7;
const HEADER_FONT_SIZE = 8;
const TITLE_FONT_SIZE = 12;

const COL_WIDTHS = {
  code: 35,
  name: 140,
  kcCan: 62,
  kcNonCan: 62,
  svcCan: 62,
  svcNonCan: 62,
  postCan: 62,
  postNonCan: 62,
  other: 62,
  total: 62,
};

const COLUMNS = [
  { key: 'code' as const, label: 'Acct #', width: COL_WIDTHS.code },
  { key: 'name' as const, label: 'Expense Account', width: COL_WIDTHS.name },
  { key: 'kcCan' as const, label: 'Key Creative\nCanadian', width: COL_WIDTHS.kcCan },
  { key: 'kcNonCan' as const, label: 'Key Creative\nNon-Canadian', width: COL_WIDTHS.kcNonCan },
  { key: 'svcCan' as const, label: 'Services\nCanadian', width: COL_WIDTHS.svcCan },
  { key: 'svcNonCan' as const, label: 'Services\nNon-Canadian', width: COL_WIDTHS.svcNonCan },
  { key: 'postCan' as const, label: 'Post-Prod\nCan.', width: COL_WIDTHS.postCan },
  { key: 'postNonCan' as const, label: 'Post-Prod\nNon-Can.', width: COL_WIDTHS.postNonCan },
  { key: 'other' as const, label: 'Other\nCosts', width: COL_WIDTHS.other },
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

export function buildCptcPartAPdfHeaderLines(doc: CptcPartADocument): string[] {
  return [
    doc.formLabel.toUpperCase(),
    `Form ${doc.formCode}`,
    `Production: ${doc.projectTitle}`,
    `Budget: ${doc.budgetVersionName} (LOCKED)`,
    `Generated: ${doc.generatedAt.toISOString().slice(0, 10)}`,
  ];
}

export function buildCptcPartAPdfSummaryRows(doc: CptcPartADocument): string[][] {
  return doc.summaryLineDefinitions.map((definition) =>
    summaryRowValues(definition, doc.summary),
  );
}

function summaryRowValues(
  definition: BocSummaryLineDefinition,
  summary: BocSummary,
): string[] {
  switch (definition.formula) {
    case 'SUM_LINE_TOTALS':
      return [
        definition.code,
        definition.label.toUpperCase(),
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        fmt(summary.totalCostOfProduction),
      ];
    case 'SUM_KEY_CREATIVE_COLUMNS':
      return [
        definition.code,
        definition.label.toUpperCase(),
        fmt(summary.totalServicesCanadian),
        fmt(summary.totalServicesNonCanadian),
        '',
        '',
        '',
        '',
        '',
        fmt(summary.totalServices),
      ];
    case 'RATIO_KEY_CREATIVE_CANADIAN':
      return [
        definition.code,
        definition.label.toUpperCase(),
        pct(summary.servicesCanadianRatio),
        pct(1 - summary.servicesCanadianRatio),
        '',
        '',
        '',
        '',
        '',
        '',
      ];
    case 'SUM_POST_LAB_COLUMNS':
      return [
        definition.code,
        definition.label.toUpperCase(),
        '',
        '',
        '',
        '',
        fmt(summary.totalPostLabCanadian),
        fmt(summary.totalPostLabNonCanadian),
        '',
        fmt(summary.totalPostLab),
      ];
    case 'RATIO_POST_LAB_CANADIAN':
      return [
        definition.code,
        definition.label.toUpperCase(),
        '',
        '',
        '',
        '',
        pct(summary.postLabCanadianRatio),
        pct(1 - summary.postLabCanadianRatio),
        '',
        '',
      ];
    default:
      return [definition.code, definition.label, '', '', '', '', '', '', '', ''];
  }
}

function rowValues(row: BocRow): string[] {
  return [
    row.accountCode,
    row.accountName,
    fmt(row.keyCreativeCanadian),
    fmt(row.keyCreativeNonCanadian),
    fmt(row.servicesCanadian),
    fmt(row.servicesNonCanadian),
    fmt(row.postProductionLabCanadian),
    fmt(row.postProductionLabNonCanadian),
    fmt(row.otherCosts),
    fmt(row.total),
  ];
}

export async function renderCptcPartAPdf(
  doc: CptcPartADocument,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0, 0, 0);
  const headerBg = rgb(0.9, 0.9, 0.9);
  const lightBg = rgb(0.96, 0.96, 0.96);
  const borderColor = rgb(0.7, 0.7, 0.7);

  const tableWidth = COLUMNS.reduce((sum, c) => sum + c.width, 0);
  const startX = MARGIN;

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const headerLines = buildCptcPartAPdfHeaderLines(doc);
  for (let i = 0; i < headerLines.length; i++) {
    const line = headerLines[i]!;
    page.drawText(line, {
      x: startX,
      y,
      size: i === 0 ? TITLE_FONT_SIZE : i === 1 ? 8 : i === 2 ? 9 : 7,
      font: i <= 1 ? boldFont : font,
      color: i >= headerLines.length - 2 && i > 2 ? rgb(0.4, 0.4, 0.4) : black,
    });
    y -= i === 0 ? 16 : i === 2 ? 12 : 12;
  }
  y -= 8;

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
    const lines = col.label.split('\n');
    lines.forEach((line, i) => {
      page.drawText(line, {
        x: colX + 3,
        y: headerTop - 12 - i * 10,
        size: HEADER_FONT_SIZE,
        font: boldFont,
        color: black,
      });
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

  const drawRow = (values: string[], isBold: boolean, bg?: typeof lightBg) => {
    if (y - ROW_HEIGHT < MARGIN + 40) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
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
      const val = values[i] ?? '';
      const isNumeric = i >= 2;
      const textWidth = rowFont.widthOfTextAtSize(val, FONT_SIZE);
      const textX = isNumeric
        ? cx + col.width - textWidth - 3
        : cx + 3;

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
    const vals = rowValues(row);
    drawRow(vals, row.isHeader, row.isHeader ? lightBg : undefined);
  }

  y -= 6;
  const summaryRows = buildCptcPartAPdfSummaryRows(doc);

  for (let i = 0; i < summaryRows.length; i++) {
    drawRow(summaryRows[i]!, i === 0, i === 0 ? headerBg : undefined);
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

    for (const w of doc.warnings) {
      if (y < MARGIN) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }
      page.drawText(`• ${w.message}`, {
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
