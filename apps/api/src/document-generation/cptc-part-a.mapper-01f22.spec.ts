import {
  CPTC_BOC_FORM_CODE_ANIMATION,
  loadCptcBocRegistryForForm,
} from '@storyos/program-registry';
import { mapCptcPartAWithRegistry } from './cptc-part-a.mapper-v2';
import {
  buildAnimationBudgetLine,
  buildAnimationCptcPartAData,
  caAnimationResidency,
} from './__fixtures__/cptc-part-a-animation.fixtures';

describe('mapCptcPartAWithRegistry (01F22 animation — Slice 5D)', () => {
  const registry = loadCptcBocRegistryForForm(CPTC_BOC_FORM_CODE_ANIMATION);

  it('places voice director on key creative and rolls section 52 fringe', () => {
    const director = buildAnimationBudgetLine({
      amount: 8000,
      account: { code: '52.05', name: 'Voice Director' },
      personId: 'person-voice-director',
    });
    const fringe = buildAnimationBudgetLine({
      amount: 1200,
      budgetAccountId: 'acct-52-90',
      account: { id: 'acct-52-90', code: '52.90', name: 'Fringes', sortOrder: 2 },
      personId: 'person-voice-director',
    });
    const editor = buildAnimationBudgetLine({
      amount: 3500,
      budgetAccountId: 'acct-52-20',
      account: { id: 'acct-52-20', code: '52.20', name: 'Voice Editor', sortOrder: 3 },
      personId: 'person-voice-editor',
    });

    const residencies = caAnimationResidency('person-voice-director', 'person-voice-editor');
    const doc = mapCptcPartAWithRegistry(
      buildAnimationCptcPartAData([director, fringe, editor], residencies),
      registry,
    );

    expect(doc.formCode).toBe('01F22');
    expect(doc.rows.find((row) => row.accountCode === '7.4.a')).toMatchObject({
      keyCreativeCanadian: 9200,
      servicesCanadian: 0,
    });
    expect(doc.rows.find((row) => row.accountCode === '7.4.b')).toMatchObject({
      servicesCanadian: 3500,
      keyCreativeCanadian: 0,
    });
    expect(doc.allocationTrace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountCode: '52.90',
          formLineCode: '7.4.a',
          rollupKind: 'fringe',
          amount: 1200,
        }),
      ]),
    );
  });

  it('maps lead and supporting voice performers to 6.1/6.2 key creative lines', () => {
    const leadVoice = buildAnimationBudgetLine({
      amount: 25000,
      account: { code: '06.01', name: 'Stars/Star (Lead) Voices' },
      personId: 'person-lead-voice',
    });
    const supportingVoice = buildAnimationBudgetLine({
      amount: 6000,
      budgetAccountId: 'acct-10-25',
      account: { id: 'acct-10-25', code: '10.25', name: 'Voice/Off-camera Performers', sortOrder: 2 },
      personId: 'person-supporting-voice',
    });

    const residencies = caAnimationResidency('person-lead-voice', 'person-supporting-voice');
    const doc = mapCptcPartAWithRegistry(
      buildAnimationCptcPartAData([leadVoice, supportingVoice], residencies),
      registry,
    );

    expect(doc.rows.find((row) => row.accountCode === '6.1.a')).toMatchObject({
      keyCreativeCanadian: 25000,
    });
    expect(doc.rows.find((row) => row.accountCode === '6.2.a')).toMatchObject({
      keyCreativeCanadian: 6000,
    });
  });

  it('maps animation labour sections to 7.3–7.8 and rolls section fringes', () => {
    const lineProducer = buildAnimationBudgetLine({
      amount: 9000,
      account: { code: '53.01', name: 'Line Producer - Animation' },
      personId: 'person-line-producer',
    });
    const productionFringe = buildAnimationBudgetLine({
      amount: 1500,
      budgetAccountId: 'acct-53-90',
      account: { id: 'acct-53-90', code: '53.90', name: 'Fringes', sortOrder: 2 },
      personId: 'person-line-producer',
    });
    const keyAnimator = buildAnimationBudgetLine({
      amount: 7000,
      budgetAccountId: 'acct-55-10',
      account: { id: 'acct-55-10', code: '55.10', name: 'Key Animator/Key Posing Artist', sortOrder: 3 },
      personId: 'person-key-animator',
    });
    const inBetweener = buildAnimationBudgetLine({
      amount: 4200,
      budgetAccountId: 'acct-55-50',
      account: { id: 'acct-55-50', code: '55.50', name: 'Animator', sortOrder: 4 },
      personId: 'person-inbetweener',
    });
    const animationFringe = buildAnimationBudgetLine({
      amount: 900,
      budgetAccountId: 'acct-55-90',
      account: { id: 'acct-55-90', code: '55.90', name: 'Fringes', sortOrder: 5 },
      personId: 'person-key-animator',
    });
    const threeDDirector = buildAnimationBudgetLine({
      amount: 11000,
      budgetAccountId: 'acct-56-01',
      account: { id: 'acct-56-01', code: '56.01', name: '3D Animation Director', sortOrder: 6 },
      personId: 'person-3d-director',
    });
    const mocapSupervisor = buildAnimationBudgetLine({
      amount: 5000,
      budgetAccountId: 'acct-57-15',
      account: { id: 'acct-57-15', code: '57.15', name: 'Motion Capture Supervisor', sortOrder: 7 },
      personId: 'person-mocap',
    });

    const residencies = caAnimationResidency(
      'person-line-producer',
      'person-key-animator',
      'person-inbetweener',
      'person-3d-director',
      'person-mocap',
    );

    const doc = mapCptcPartAWithRegistry(
      buildAnimationCptcPartAData(
        [
          lineProducer,
          productionFringe,
          keyAnimator,
          inBetweener,
          animationFringe,
          threeDDirector,
          mocapSupervisor,
        ],
        residencies,
      ),
      registry,
    );

    expect(doc.rows.find((row) => row.accountCode === '7.3.a')).toMatchObject({
      keyCreativeCanadian: 10500,
      servicesCanadian: 0,
    });
    expect(doc.rows.find((row) => row.accountCode === '7.5.a')).toMatchObject({
      keyCreativeCanadian: 7900,
    });
    expect(doc.rows.find((row) => row.accountCode === '7.7')).toMatchObject({
      servicesCanadian: 4200,
    });
    expect(doc.rows.find((row) => row.accountCode === '7.6.a')).toMatchObject({
      keyCreativeCanadian: 11000,
    });
    expect(doc.rows.find((row) => row.accountCode === '7.14.a')).toMatchObject({
      keyCreativeCanadian: 5000,
    });
  });

  it('preserves document totals when animation fringes are rolled into remuneration lines', () => {
    const keyAnimator = buildAnimationBudgetLine({
      amount: 5000,
      account: { code: '55.10', name: 'Key Animator/Key Posing Artist' },
      personId: 'person-key-animator',
    });
    const fringe = buildAnimationBudgetLine({
      amount: 750,
      budgetAccountId: 'acct-55-90',
      account: { id: 'acct-55-90', code: '55.90', name: 'Fringes', sortOrder: 2 },
      personId: 'person-key-animator',
    });

    const doc = mapCptcPartAWithRegistry(
      buildAnimationCptcPartAData(
        [keyAnimator, fringe],
        caAnimationResidency('person-key-animator'),
      ),
      registry,
    );

    const inputTotal = 5750;
    expect(doc.summary.totalCostOfProduction).toBe(inputTotal);
    expect(doc.rows.find((row) => row.accountCode === '7.5.a')?.total).toBe(inputTotal);
    expect(doc.rows.some((row) => row.accountCode === '55.90')).toBe(false);
  });
});
