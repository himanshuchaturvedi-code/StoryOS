import {
  CPTC_BOC_FORM_CODE_ANIMATION,
  CPTC_BOC_FORM_CODE_LIVE_ACTION,
  loadCptcBocRegistryForForm,
} from '@storyos/program-registry';
import type { CptcPartADocument } from '@storyos/types';
import { buildCptcBocDocumentTitle, buildCptcBocFileName } from './cptc-boc-document-metadata';
import { mapCptcPartAWithRegistry } from './cptc-part-a.mapper-v2';
import { buildCptcPartAData } from './__fixtures__/cptc-part-a.fixtures';
import { buildAnimationCptcPartAData } from './__fixtures__/cptc-part-a-animation.fixtures';
import {
  buildCptcPartAPdfHeaderLines,
  buildCptcPartAPdfSummaryRows,
  renderCptcPartAPdf,
  sanitizePdfText,
} from './pdf.renderer';

function emptySummary() {
  return {
    totalCostOfProduction: 0,
    totalServicesCanadian: 0,
    totalServicesNonCanadian: 0,
    totalServices: 0,
    servicesCanadianRatio: 0,
    totalPostLabCanadian: 0,
    totalPostLabNonCanadian: 0,
    totalPostLab: 0,
    postLabCanadianRatio: 0,
  };
}

function buildDocumentFromRegistry(
  formCode: typeof CPTC_BOC_FORM_CODE_LIVE_ACTION | typeof CPTC_BOC_FORM_CODE_ANIMATION,
  projectTitle: string,
): CptcPartADocument {
  const registry = loadCptcBocRegistryForForm(formCode);
  const data =
    formCode === CPTC_BOC_FORM_CODE_ANIMATION
      ? buildAnimationCptcPartAData([])
      : buildCptcPartAData([]);
  data.project.title = projectTitle;
  return mapCptcPartAWithRegistry(data, registry);
}

function pdfLooksValid(pdf: Buffer): boolean {
  return pdf.length > 1000 && pdf.subarray(0, 5).toString('ascii') === '%PDF-';
}

describe('buildCptcBocFileName', () => {
  it('includes the CPTC form code in the generated filename', () => {
    expect(
      buildCptcBocFileName({
        formCode: '01F21',
        projectTitle: 'Dev Feature Film',
        generatedAt: new Date('2026-06-21T12:00:00.000Z'),
      }),
    ).toBe('CPTC_BOC_01F21_Dev_Feature_Film_20260621.pdf');

    expect(
      buildCptcBocFileName({
        formCode: '01F22',
        projectTitle: 'Animated Series',
        generatedAt: new Date('2026-06-21T12:00:00.000Z'),
      }),
    ).toBe('CPTC_BOC_01F22_Animated_Series_20260621.pdf');
  });
});

describe('buildCptcBocDocumentTitle', () => {
  it('identifies the registry form variant in the stored document title', () => {
    expect(
      buildCptcBocDocumentTitle({
        formCode: '01F21',
        formLabel: 'Breakdown of Costs — Live Action',
        projectTitle: 'Dev Feature Film',
      }),
    ).toBe('CPTC BOC 01F21 — Breakdown of Costs — Live Action — Dev Feature Film');
  });
});

describe('renderCptcPartAPdf (Slice 5F registry-driven presentation)', () => {
  it('renders live-action title, form code, and 11.x summary rows for 01F21', async () => {
    const doc = buildDocumentFromRegistry(CPTC_BOC_FORM_CODE_LIVE_ACTION, 'Live Action Project');
    doc.generatedAt = new Date('2026-06-21T00:00:00.000Z');

    expect(buildCptcPartAPdfHeaderLines(doc)).toEqual([
      'BREAKDOWN OF COSTS — LIVE ACTION',
      'Form 01F21',
      'Production: Live Action Project',
      'Budget: Locked v1 (LOCKED)',
      'Generated: 2026-06-21',
    ]);
    expect(buildCptcPartAPdfSummaryRows(doc).map((row) => row[0])).toEqual([
      '11.0',
      '11.1',
      '11.2',
      '11.3',
      '11.4',
    ]);

    const pdf = await renderCptcPartAPdf(doc);

    expect(pdfLooksValid(pdf)).toBe(true);
  });

  it('renders animation title, form code, and 10.x summary rows for 01F22', async () => {
    const doc = buildDocumentFromRegistry(CPTC_BOC_FORM_CODE_ANIMATION, 'Animation Project');
    doc.generatedAt = new Date('2026-06-21T00:00:00.000Z');

    expect(buildCptcPartAPdfHeaderLines(doc)).toEqual([
      'BREAKDOWN OF COSTS — ANIMATION',
      'Form 01F22',
      'Production: Animation Project',
      'Budget: Locked v1 (LOCKED)',
      'Generated: 2026-06-21',
    ]);
    expect(buildCptcPartAPdfSummaryRows(doc).map((row) => row[0])).toEqual([
      '10.0',
      '10.1',
      '10.2',
      '10.3',
      '10.4',
    ]);

    const pdf = await renderCptcPartAPdf(doc);

    expect(pdfLooksValid(pdf)).toBe(true);
    expect(buildCptcPartAPdfSummaryRows(doc).some((row) => row[0] === '11.0')).toBe(false);
  });

  it('uses registry summary labels rather than hardcoded live-action text', () => {
    const doc = buildDocumentFromRegistry(CPTC_BOC_FORM_CODE_ANIMATION, 'Animation Project');
    const summaryRows = buildCptcPartAPdfSummaryRows(doc);

    expect(summaryRows[0]?.[1]).toContain('TOTAL COST OF PRODUCTION');
    expect(summaryRows[1]?.[1]).toContain('TOTAL SERVICES');
    expect(summaryRows.some((row) => row[0] === '11.0')).toBe(false);
  });

  it('renders no summary rows when registry summary definitions are absent', async () => {
    const doc: CptcPartADocument = {
      documentType: 'CPTC_PART_A',
      projectTitle: 'Legacy',
      budgetVersionId: 'version-1',
      budgetVersionName: 'Locked v1',
      formCode: '01F21',
      formLabel: 'Breakdown of Costs — Live Action',
      summaryLineDefinitions: [],
      rows: [],
      summary: emptySummary(),
      warnings: [],
      generatedAt: new Date('2026-06-21T00:00:00.000Z'),
    };

    expect(buildCptcPartAPdfSummaryRows(doc)).toEqual([]);
    const pdf = await renderCptcPartAPdf(doc);
    expect(pdfLooksValid(pdf)).toBe(true);
    expect(buildCptcPartAPdfHeaderLines(doc)[1]).toBe('Form 01F21');
  });

  it('sanitizes Unicode punctuation for Standard PDF fonts', () => {
    expect(sanitizePdfText('Hybrid ≥50%; sections 52–59 and 12–51')).toBe(
      'Hybrid >=50%; sections 52-59 and 12-51',
    );
  });
});
