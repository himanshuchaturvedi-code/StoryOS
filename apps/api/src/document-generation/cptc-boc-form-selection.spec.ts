import { FormatType } from '@storyos/types';
import {
  CPTC_BOC_FORM_CODE_ANIMATION,
  CPTC_BOC_FORM_CODE_LIVE_ACTION,
} from '@storyos/program-registry';
import { loadCptcBocRegistryForForm } from '@storyos/program-registry';
import {
  buildCptcBocBudgetFormWarnings,
  resolveCptcBocFormSelection,
  sumLiveActionProductionSectionSpend,
  type ProjectFormatSnapshot,
} from './cptc-boc-form-selection';
import { mapCptcPartAWithRegistry } from './cptc-part-a.mapper-v2';
import { renderCptcPartAPdf } from './pdf.renderer';
import { buildBudgetLine, buildCptcPartAData } from './__fixtures__/cptc-part-a.fixtures';
import {
  buildHybridCptcPartAData,
  buildHybridProjectFormat,
  buildRepresentativeHybridBudgetLines,
} from './__fixtures__/cptc-part-a-hybrid.fixtures';

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

describe('resolveCptcBocFormSelection (Slice 5G hybrid QA)', () => {
  it('warns on live-action projects with animation section spend', () => {
    const selection = resolveCptcBocFormSelection(format(), [
      buildBudgetLine({
        amount: 7500,
        account: { code: '55.10', name: 'Key Animator/Key Posing Artist' },
      }),
    ]);

    expect(selection.formCode).toBe(CPTC_BOC_FORM_CODE_LIVE_ACTION);
    expect(selection.warnings.some((w) => /52–59/i.test(w.message))).toBe(true);
  });

  it('warns on animation projects with live-action production section spend', () => {
    const selection = resolveCptcBocFormSelection(
      {
        formatType: FormatType.ANIMATION_FEATURE,
        isLiveAction: false,
        hasAnimation: true,
        animationPercentage: null,
      },
      [
        buildBudgetLine({
          amount: 9000,
          account: { code: '23.01', name: 'Key Grip' },
        }),
      ],
    );

    expect(selection.formCode).toBe(CPTC_BOC_FORM_CODE_ANIMATION);
    expect(selection.warnings.some((w) => /12–51/i.test(w.message))).toBe(true);
  });

  it('selects 01F22 for hybrid projects above 50% animation with predominant-format warning', () => {
    const lines = buildRepresentativeHybridBudgetLines();
    const selection = resolveCptcBocFormSelection(buildHybridProjectFormat(65), lines);

    expect(selection.formCode).toBe(CPTC_BOC_FORM_CODE_ANIMATION);
    expect(selection.reason).toBe('hybrid_animation_percentage');
    expect(selection.warnings.some((w) => /predominant format is animation/i.test(w.message))).toBe(
      true,
    );
    expect(selection.warnings.some((w) => /12–51/i.test(w.message))).toBe(true);
  });

  it('selects 01F21 for hybrid projects below 50% animation with animation spend warning', () => {
    const lines = buildRepresentativeHybridBudgetLines();
    const selection = resolveCptcBocFormSelection(buildHybridProjectFormat(35), lines);

    expect(selection.formCode).toBe(CPTC_BOC_FORM_CODE_LIVE_ACTION);
    expect(selection.reason).toBe('hybrid_live_action_percentage');
    expect(selection.warnings.some((w) => /predominant format is live action/i.test(w.message))).toBe(
      true,
    );
    expect(selection.warnings.some((w) => /52–59/i.test(w.message))).toBe(true);
  });

  it('defaults hybrid projects without animation percentage to 01F21 with ambiguous warnings', () => {
    const selection = resolveCptcBocFormSelection(buildHybridProjectFormat(null), []);

    expect(selection.formCode).toBe(CPTC_BOC_FORM_CODE_LIVE_ACTION);
    expect(selection.reason).toBe('hybrid_ambiguous');
    expect(selection.warnings.filter((w) => /ambiguous/i.test(w.message)).length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it('defaults missing ProjectFormat to 01F21 with warning', () => {
    const selection = resolveCptcBocFormSelection(null, []);
    expect(selection.formCode).toBe(CPTC_BOC_FORM_CODE_LIVE_ACTION);
    expect(selection.warnings.some((w) => /not set/i.test(w.message))).toBe(true);
  });

  it('maps hybrid fixture end-to-end with form-specific warnings on the generated document', () => {
    const data = buildHybridCptcPartAData(
      buildRepresentativeHybridBudgetLines(),
      65,
    );
    const selection = resolveCptcBocFormSelection(data.projectFormat, data.lines);
    const registry = loadCptcBocRegistryForForm(selection.formCode);
    const doc = mapCptcPartAWithRegistry(data, registry);
    doc.warnings.unshift(...selection.warnings);

    expect(doc.formCode).toBe('01F22');
    expect(doc.warnings.some((w) => /12–51/i.test(w.message))).toBe(true);
    expect(sumLiveActionProductionSectionSpend(data.lines)).toBe(12000);
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
