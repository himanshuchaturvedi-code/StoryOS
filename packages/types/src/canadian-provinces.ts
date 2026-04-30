/**
 * Canonical Canadian province/territory ISO 3166-2 codes for Location.provinceState,
 * residency, and spend/activity projections that read location.
 *
 * Single authored list: everything else (`CANADIAN_PROVINCES`, labels, UI options, migration)
 * derives from `CANADIAN_PROVINCE_DEFINITIONS` only.
 */
export const CANADIAN_PROVINCE_DEFINITIONS = [
  { code: 'CA-AB', label: 'Alberta' },
  { code: 'CA-BC', label: 'British Columbia' },
  { code: 'CA-MB', label: 'Manitoba' },
  { code: 'CA-NB', label: 'New Brunswick' },
  {
    code: 'CA-NL',
    label: 'Newfoundland and Labrador',
    aliases: ['newfoundland'] as const,
  },
  { code: 'CA-NS', label: 'Nova Scotia' },
  { code: 'CA-NT', label: 'Northwest Territories' },
  { code: 'CA-NU', label: 'Nunavut' },
  { code: 'CA-ON', label: 'Ontario' },
  { code: 'CA-PE', label: 'Prince Edward Island', aliases: ['pei'] as const },
  {
    code: 'CA-QC',
    label: 'Quebec',
    aliases: ['québec', 'pq', 'quebec'] as const,
  },
  { code: 'CA-SK', label: 'Saskatchewan' },
  { code: 'CA-YT', label: 'Yukon' },
] as const;

export type CanadianProvince = (typeof CANADIAN_PROVINCE_DEFINITIONS)[number]['code'];

export const CANADIAN_PROVINCES: readonly CanadianProvince[] = CANADIAN_PROVINCE_DEFINITIONS.map(
  (d) => d.code,
);

export const CANADIAN_PROVINCE_LABELS = Object.fromEntries(
  CANADIAN_PROVINCE_DEFINITIONS.map((d) => [d.code, d.label]),
) as Record<CanadianProvince, string>;

export const CANADIAN_PROVINCE_OPTIONS: readonly { code: CanadianProvince; label: string }[] =
  CANADIAN_PROVINCE_DEFINITIONS.map(({ code, label }) => ({ code, label }));

export const CANADIAN_PROVINCE_CODE_SET = new Set<string>(CANADIAN_PROVINCES);

function migrationNormKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function buildCanadianProvinceMigrationIndex(): Map<string, CanadianProvince> {
  const m = new Map<string, CanadianProvince>();
  for (const def of CANADIAN_PROVINCE_DEFINITIONS) {
    const { code, label } = def;
    m.set(migrationNormKey(label), code);
    m.set(migrationNormKey(code), code);
    const suffix = code.slice(3);
    m.set(suffix.toLowerCase(), code);
    m.set(suffix.toUpperCase(), code);
    const aliases = 'aliases' in def ? def.aliases : undefined;
    if (aliases) {
      for (const a of aliases) {
        m.set(migrationNormKey(a), code);
      }
    }
  }
  return m;
}

const MIGRATION_INDEX = buildCanadianProvinceMigrationIndex();

/**
 * Maps legacy stored values to canonical CA-* codes (DB cleanup only).
 * Deterministic: labels, codes, CA-XX suffixes, and `aliases` on definitions only.
 */
export function normalizeCanadianProvinceState(
  raw: string | null | undefined,
): { code: string | null; unknown: boolean } {
  if (raw == null || !String(raw).trim()) return { code: null, unknown: false };
  const t = String(raw).trim();
  if (CANADIAN_PROVINCE_CODE_SET.has(t)) return { code: t, unknown: false };
  const key = migrationNormKey(t);
  const fromIndex = MIGRATION_INDEX.get(key);
  if (fromIndex) return { code: fromIndex, unknown: false };
  const upper = t.toUpperCase();
  if (upper.startsWith('CA-') && CANADIAN_PROVINCE_CODE_SET.has(upper)) {
    return { code: upper, unknown: false };
  }
  return { code: null, unknown: true };
}
