export interface IncentiveRegion {
  code: string;
  label: string;
  provinceState: string;
  /**
   * Category bucket for incentive calculations.
   * Used to group regions into bonus-eligible categories
   * (e.g. all ON-OUTSIDE-GTA regions map to the OFTTC 'outside GTA' bonus).
   */
  category: 'metro' | 'regional' | 'distant' | 'rural' | 'northern';
  /** @deprecated use incentiveRegionCode-based lookups instead */
  zoneCode: string | null;
}

export const INCENTIVE_REGIONS = [
  // ── Ontario ──
  {
    code: 'ON-GTA',
    label: 'Greater Toronto Area',
    provinceState: 'CA-ON',
    category: 'metro',
    zoneCode: null,
  },
  {
    code: 'ON-NORTHERN',
    label: 'Northern Ontario',
    provinceState: 'CA-ON',
    category: 'distant',
    zoneCode: 'ON-NORTHERN',
  },
  {
    code: 'ON-EASTERN',
    label: 'Eastern Ontario',
    provinceState: 'CA-ON',
    category: 'regional',
    zoneCode: 'ON-EASTERN',
  },
  {
    code: 'ON-SOUTHWESTERN',
    label: 'Southwestern Ontario',
    provinceState: 'CA-ON',
    category: 'regional',
    zoneCode: 'ON-SOUTHWESTERN',
  },
  // ── British Columbia ──
  {
    code: 'BC-METRO',
    label: 'Metro Vancouver',
    provinceState: 'CA-BC',
    category: 'metro',
    zoneCode: null,
  },
  {
    code: 'BC-REGIONAL',
    label: 'BC Regional',
    provinceState: 'CA-BC',
    category: 'regional',
    zoneCode: 'BC-REGIONAL',
  },
  {
    code: 'BC-DISTANT',
    label: 'BC Distant',
    provinceState: 'CA-BC',
    category: 'distant',
    zoneCode: null,
  },
  // ── Alberta ──
  {
    code: 'AB-METRO',
    label: 'Calgary / Edmonton',
    provinceState: 'CA-AB',
    category: 'metro',
    zoneCode: null,
  },
  {
    code: 'AB-REGIONAL',
    label: 'Alberta Regional',
    provinceState: 'CA-AB',
    category: 'regional',
    zoneCode: 'AB-REGIONAL',
  },
  {
    code: 'AB-RURAL',
    label: 'Alberta Rural / Remote',
    provinceState: 'CA-AB',
    category: 'rural',
    zoneCode: null,
  },
  // ── Manitoba ──
  {
    code: 'MB-WINNIPEG',
    label: 'Winnipeg',
    provinceState: 'CA-MB',
    category: 'metro',
    zoneCode: null,
  },
  {
    code: 'MB-RURAL',
    label: 'Rural Manitoba',
    provinceState: 'CA-MB',
    category: 'rural',
    zoneCode: null,
  },
  {
    code: 'MB-NORTHERN',
    label: 'Northern Manitoba',
    provinceState: 'CA-MB',
    category: 'northern',
    zoneCode: null,
  },
  // ── Quebec ──
  {
    code: 'QC-METRO',
    label: 'Montreal CMA',
    provinceState: 'CA-QC',
    category: 'metro',
    zoneCode: null,
  },
  {
    code: 'QC-REGIONAL',
    label: 'Quebec Regional',
    provinceState: 'CA-QC',
    category: 'regional',
    zoneCode: 'QC-REGIONAL',
  },
] as const satisfies readonly IncentiveRegion[];

export type IncentiveRegionCode = (typeof INCENTIVE_REGIONS)[number]['code'];

export const INCENTIVE_REGION_CODES = INCENTIVE_REGIONS.map((r) => r.code);

/** Set of all valid region codes, for runtime validation. */
export const VALID_REGION_CODES = new Set<string>(INCENTIVE_REGION_CODES);
