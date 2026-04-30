import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { CptcPartADocument, BocRow, BocSummary } from '@storyos/types';

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
  name: 170,
  kcCan: 75,
  kcNonCan: 75,
  svcCan: 75,
  svcNonCan: 75,
  postLab: 75,
  other: 75,
  total: 75,
};

const COLUMNS = [
  { key: 'code' as const, label: 'Acct #', width: COL_WIDTHS.code },
  { key: 'name' as const, label: 'Expense Account', width: COL_WIDTHS.name },
  { key: 'kcCan' as const, label: 'Key Creative\nCanadian', width: COL_WIDTHS.kcCan },
  { key: 'kcNonCan' as const, label: 'Key Creative\nNon-Canadian', width: COL_WIDTHS.kcNonCan },
  { key: 'svcCan' as const, label: 'Services\nCanadian', width: COL_WIDTHS.svcCan },
  { key: 'svcNonCan' as const, label: 'Services\nNon-Canadian', width: COL_WIDTHS.svcNonCan },
  { key: 'postLab' as const, label: 'Post-Prod\n& Lab', width: COL_WIDTHS.postLab },
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

function rowValues(row: BocRow): string[] {
  return [
    row.accountCode,
    row.accountName,
    fmt(row.keyCreativeCanadian),
    fmt(row.keyCreativeNonCanadian),
    fmt(row.servicesCanadian),
    fmt(row.servicesNonCanadian),
    fmt(row.postProductionLab),
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

  page.drawText('BREAKDOWN OF COSTS — LIVE ACTION', {
    x: startX,
    y,
    size: TITLE_FONT_SIZE,
    font: boldFont,
    color: black,
  });
  y -= 16;

  page.drawText(`Production: ${doc.projectTitle}`, {
    x: startX,
    y,
    size: 9,
    font,
    color: black,
  });
  y -= 12;

  page.drawText(
    `Generated: ${doc.generatedAt.toISOString().slice(0, 10)}`,
    { x: startX, y, size: 7, font, color: rgb(0.4, 0.4, 0.4) },
  );
  y -= 20;

  // Column headers
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

  // Summary section
  y -= 6;
  const s = doc.summary;

  drawRow(
    ['11.0', 'TOTAL COST OF PRODUCTION', '', '', '', '', '', '', fmt(s.totalCostOfProduction)],
    true,
    headerBg,
  );
  drawRow(
    ['11.1', 'TOTAL SERVICES', fmt(s.totalServicesCanadian), fmt(s.totalServicesNonCanadian), '', '', '', '', fmt(s.totalServices)],
    false,
    undefined,
  );
  drawRow(
    ['11.2', 'RATIO % (Can. to non-Can.)', pct(s.servicesCanadianRatio), pct(1 - s.servicesCanadianRatio), '', '', '', '', ''],
    false,
    undefined,
  );
  drawRow(
    ['11.3', 'TOTAL POST-PRODUCTION / LAB', '', '', fmt(s.totalPostLabCanadian), fmt(s.totalPostLabNonCanadian), '', '', fmt(s.totalPostLab)],
    false,
    undefined,
  );
  drawRow(
    ['11.4', 'RATIO % (Can. to non-Can.)', '', '', pct(s.postLabCanadianRatio), pct(1 - s.postLabCanadianRatio), '', '', ''],
    false,
    undefined,
  );

  // Warnings footer
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
