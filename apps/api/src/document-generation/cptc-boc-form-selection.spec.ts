import { FormatType } from '@storyos/types';
import {
  CPTC_BOC_FORM_CODE_ANIMATION,
  CPTC_BOC_FORM_CODE_LIVE_ACTION,
} from '@storyos/program-registry';
import { loadCptcBocRegistryForForm } from '@storyos/program-registry';
import {
  buildCptcBocBudgetFormWarnings,
  resolveCptcBocFormSelection,
  type ProjectFormatSnapshot,
} from './cptc-boc-form-selection';
import { mapCptcPartAWithRegistry } from './cptc-part-a.mapper-v2';
import { renderCptcPartAPdf } from './pdf.renderer';
import { buildBudgetLine, buildCptcPartAData } from './__fixtures__/cptc-part-a.fixtures';

function format(overrides: Partial<ProjectFormatSnapshot> = {}): ProjectFormatSnapshot {
  return {
    formatType: FormatType.FEATURE_FILM,
    isLiveAction: true,
    hasAnimation: false,
    animationPercentage: null,
    ...overrides,
  };
}

describe('resolveCptcBocFormSelection', () => {
  it('defaults live-action/default projects to 01F21', () => {
    const selection = resolveCptcBocFormSelection(format(), []);
    expect(selection.formCode).toBe(CPTC_BOC_FORM_CODE_LIVE_ACTION);
    expect(selection.reason).toBe('live_action_default');
  });

  it('selects 01F22 for animation feature and series format types', () => {
    expect(
      resolveCptcBocFormSelection(
        format({ formatType: FormatType.ANIMATION_FEATURE }),
        [],
      ).formCode,
    ).toBe(CPTC_BOC_FORM_CODE_ANIMATION);

    expect(
      resolveCptcBocFormSelection(
        format({ formatType: FormatType.ANIMATION_SERIES }),
        [],
      ).formCode,
    ).toBe(CPTC_BOC_FORM_CODE_ANIMATION);
  });

  it('defaults to 01F21 with warning when ProjectFormat is missing', () => {
    const selection = resolveCptcBocFormSelection(null, []);
    expect(selection.formCode).toBe(CPTC_BOC_FORM_CODE_LIVE_ACTION);
    expect(selection.warnings.some((w) => /not set/i.test(w.message))).toBe(true);
  });

  it('warns when 01F21 is selected but animation sections 52–59 have spend', () => {
    const lines = [
      buildBudgetLine({
        amount: 5000,
        account: { code: '52.01', name: 'Voice talent' },
      }),
    ];
    const warnings = buildCptcBocBudgetFormWarnings(CPTC_BOC_FORM_CODE_LIVE_ACTION, lines);
    expect(warnings.some((w) => /52–59/i.test(w.message))).toBe(true);
  });

  it('warns when 01F22 is selected but no animation section spend exists', () => {
    const lines = [
      buildBudgetLine({
        amount: 5000,
        account: { code: '23.01', name: 'Grip' },
      }),
    ];
    const warnings = buildCptcBocBudgetFormWarnings(CPTC_BOC_FORM_CODE_ANIMATION, lines);
    expect(warnings.some((w) => /no spend in Telefilm animation sections/i.test(w.message))).toBe(
      true,
    );
  });

  it('selects 01F22 for hybrid projects with animation percentage above 50%', () => {
    const selection = resolveCptcBocFormSelection(
      format({
        isLiveAction: true,
        hasAnimation: true,
        animationPercentage: 60,
      }),
      [],
    );
    expect(selection.formCode).toBe(CPTC_BOC_FORM_CODE_ANIMATION);
    expect(selection.warnings.some((w) => /Hybrid project/i.test(w.message))).toBe(true);
  });

  it('selects 01F21 for hybrid projects with animation percentage below 50%', () => {
    const selection = resolveCptcBocFormSelection(
      format({
        isLiveAction: true,
        hasAnimation: true,
        animationPercentage: 40,
      }),
      [],
    );
    expect(selection.formCode).toBe(CPTC_BOC_FORM_CODE_LIVE_ACTION);
    expect(selection.warnings.some((w) => /Hybrid project/i.test(w.message))).toBe(true);
  });
});

describe('CPTC form selection integration', () => {
  it('maps live-action registry with 11.x summary definitions', () => {
    const registry = loadCptcBocRegistryForForm(CPTC_BOC_FORM_CODE_LIVE_ACTION);
    const doc = mapCptcPartAWithRegistry(buildCptcPartAData([]), registry);
    expect(doc.formCode).toBe('01F21');
    expect(doc.formLabel).toContain('Live Action');
    expect(doc.summaryLineDefinitions.map((line) => line.code)).toEqual([
      '11.0',
      '11.1',
      '11.2',
      '11.3',
      '11.4',
    ]);
  });

  it('maps animation registry with 10.x summary definitions and animation PDF title', async () => {
    const registry = loadCptcBocRegistryForForm(CPTC_BOC_FORM_CODE_ANIMATION);
    const doc = mapCptcPartAWithRegistry(buildCptcPartAData([]), registry);
    expect(doc.formCode).toBe('01F22');
    expect(doc.formLabel).toContain('Animation');
    expect(doc.summaryLineDefinitions.map((line) => line.code)).toEqual([
      '10.0',
      '10.1',
      '10.2',
      '10.3',
      '10.4',
    ]);

    const pdf = await renderCptcPartAPdf(doc);
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
