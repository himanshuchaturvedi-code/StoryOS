import {
  CPTC_BOC_REGISTRY_TEMPLATE_ID,
  buildRegistryCoverageReport,
  findLineByCode,
  lineMapsAccount,
  loadCptcBocRegistry,
  loadCptcBocRegistryFromString,
  validateCptcBocRegistry,
} from '@storyos/program-registry';

describe('CPTC 01F21 BOC registry (Slice 4B)', () => {
  const registry = loadCptcBocRegistry();

  it('loads the default registry with expected metadata', () => {
    expect(registry.meta.programCode).toBe('CPTC');
    expect(registry.meta.formCode).toBe('01F21');
    expect(registry.meta.templateVersion).toBe(CPTC_BOC_REGISTRY_TEMPLATE_ID);
    expect(registry.lines.length).toBeGreaterThan(50);
    expect(registry.summaryLines.map((line) => line.code)).toEqual([
      '11.0',
      '11.1',
      '11.2',
      '11.3',
      '11.4',
    ]);
  });

  it('validates the default registry without errors', () => {
    const result = validateCptcBocRegistry(registry, {
      minimumCoveragePercentage: 95,
    });

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('includes representative Telefilm mappings', () => {
    const screenwriter = findLineByCode(registry, '2.0.a');
    const producer = findLineByCode(registry, '4.0.a');
    const director = findLineByCode(registry, '5.0.a');
    const electrical = findLineByCode(registry, '7.4');
    const videoPost = findLineByCode(registry, '9.5');
    const general = findLineByCode(registry, '10.3');

    expect(screenwriter).toBeDefined();
    expect(producer).toBeDefined();
    expect(director).toBeDefined();
    expect(electrical).toBeDefined();
    expect(videoPost).toBeDefined();
    expect(general).toBeDefined();

    expect(
      lineMapsAccount(screenwriter!, '02.01', CPTC_BOC_REGISTRY_TEMPLATE_ID),
    ).toBe(true);
    expect(
      lineMapsAccount(producer!, '04.05', CPTC_BOC_REGISTRY_TEMPLATE_ID),
    ).toBe(true);
    expect(
      lineMapsAccount(director!, '05.01', CPTC_BOC_REGISTRY_TEMPLATE_ID),
    ).toBe(true);
    expect(lineMapsAccount(electrical!, '23.01', CPTC_BOC_REGISTRY_TEMPLATE_ID)).toBe(
      true,
    );
    expect(lineMapsAccount(videoPost!, '62.01', CPTC_BOC_REGISTRY_TEMPLATE_ID)).toBe(
      true,
    );
    expect(lineMapsAccount(general!, '71.01', CPTC_BOC_REGISTRY_TEMPLATE_ID)).toBe(
      true,
    );
  });

  it('reports Telefilm template coverage', () => {
    const coverage = buildRegistryCoverageReport(registry);

    expect(coverage.totalAccounts).toBeGreaterThan(800);
    expect(coverage.mappedAccounts).toBeGreaterThan(0);
    expect(coverage.coveragePercentage).toBeGreaterThanOrEqual(95);
    expect(coverage.unmappedAccounts).toBeGreaterThanOrEqual(0);
  });

  it('rejects duplicate line codes', () => {
    const broken = loadCptcBocRegistryFromString(`
meta:
  programCode: CPTC
  formCode: "01F21"
  formLabel: Test
  formVersion: "2023-03-23"
  registryVersion: "test"
  templateVersion: telefilm-doc-v1
templates:
  telefilm-doc-v1:
    sourceFile: templates/standard-budget-template-documentary.xlsx
lines:
  - code: "1.0"
    label: One
    allowedColumns: [servicesCanadian]
  - code: "1.0"
    label: Duplicate
    allowedColumns: [servicesCanadian]
summaryLines:
  - code: "11.0"
    label: Total
    formula: SUM_LINE_TOTALS
    sourceLineRange: ["1.0", "1.0"]
  - code: "11.1"
    label: Services
    formula: SUM_KEY_CREATIVE_COLUMNS
  - code: "11.2"
    label: Ratio
    formula: RATIO_KEY_CREATIVE_CANADIAN
  - code: "11.3"
    label: Post
    formula: SUM_POST_LAB_COLUMNS
  - code: "11.4"
    label: Post ratio
    formula: RATIO_POST_LAB_CANADIAN
`);

    const result = validateCptcBocRegistry(broken, { validateCoverage: false });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === 'DUPLICATE_LINE_CODE')).toBe(true);
  });

  it('rejects conflicting account mappings unless allowShared is set', () => {
    const broken = loadCptcBocRegistryFromString(`
meta:
  programCode: CPTC
  formCode: "01F21"
  formLabel: Test
  formVersion: "2023-03-23"
  registryVersion: "test"
  templateVersion: telefilm-doc-v1
templates:
  telefilm-doc-v1:
    sourceFile: templates/standard-budget-template-documentary.xlsx
lines:
  - code: "1.0"
    label: One
    allowedColumns: [servicesCanadian]
    sources:
      - templateId: telefilm-doc-v1
        accounts: ["02.01"]
  - code: "2.0.a"
    label: Two
    allowedColumns: [keyCreativeCanadian]
    sources:
      - templateId: telefilm-doc-v1
        accounts: ["02.01"]
summaryLines:
  - code: "11.0"
    label: Total
    formula: SUM_LINE_TOTALS
    sourceLineRange: ["1.0", "2.0.a"]
  - code: "11.1"
    label: Services
    formula: SUM_KEY_CREATIVE_COLUMNS
  - code: "11.2"
    label: Ratio
    formula: RATIO_KEY_CREATIVE_CANADIAN
  - code: "11.3"
    label: Post
    formula: SUM_POST_LAB_COLUMNS
  - code: "11.4"
    label: Post ratio
    formula: RATIO_POST_LAB_CANADIAN
`);

    const result = validateCptcBocRegistry(broken, { validateCoverage: false });
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((error) => error.code === 'CONFLICTING_ACCOUNT_MAPPING'),
    ).toBe(true);
  });

  it('allows explicitly shared account mappings', () => {
    const shared = loadCptcBocRegistryFromString(`
meta:
  programCode: CPTC
  formCode: "01F21"
  formLabel: Test
  formVersion: "2023-03-23"
  registryVersion: "test"
  templateVersion: telefilm-doc-v1
templates:
  telefilm-doc-v1:
    sourceFile: templates/standard-budget-template-documentary.xlsx
lines:
  - code: "1.0"
    label: One
    allowedColumns: [servicesCanadian]
    sources:
      - templateId: telefilm-doc-v1
        accounts: ["04.60"]
        allowShared: true
  - code: "2.0.a"
    label: Two
    allowedColumns: [keyCreativeCanadian]
    sources:
      - templateId: telefilm-doc-v1
        accounts: ["04.60"]
        allowShared: true
summaryLines:
  - code: "11.0"
    label: Total
    formula: SUM_LINE_TOTALS
    sourceLineRange: ["1.0", "2.0.a"]
  - code: "11.1"
    label: Services
    formula: SUM_KEY_CREATIVE_COLUMNS
  - code: "11.2"
    label: Ratio
    formula: RATIO_KEY_CREATIVE_CANADIAN
  - code: "11.3"
    label: Post
    formula: SUM_POST_LAB_COLUMNS
  - code: "11.4"
    label: Post ratio
    formula: RATIO_POST_LAB_CANADIAN
`);

    const result = validateCptcBocRegistry(shared, { validateCoverage: false });
    expect(result.errors.filter((error) => error.code.includes('CONFLICTING'))).toEqual([]);
    expect(result.valid).toBe(true);
  });
});
