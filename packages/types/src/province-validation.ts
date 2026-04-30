import { CANADIAN_PROVINCE_CODE_SET } from './canadian-provinces';

function trimProvinceInput(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  return t === '' ? null : t;
}

export type ProvinceStateNormalizeResult =
  | { ok: true; value: string | null }
  | { ok: false; message: string };

/**
 * API normalization: trim, empty → null, Canada requires exact canonical code from CANADIAN_PROVINCES.
 * Rejects names and alternate spellings (run DB cleanup for legacy rows).
 */
export function normalizeProvinceStateForCountry(
  country: string,
  raw: string | null | undefined,
): ProvinceStateNormalizeResult {
  const trimmed = trimProvinceInput(raw);
  if (trimmed === null) return { ok: true, value: null };
  if (country === 'CA') {
    if (!CANADIAN_PROVINCE_CODE_SET.has(trimmed)) {
      return {
        ok: false,
        message: `Invalid Canadian province code: ${trimmed}. Use ISO 3166-2 (e.g. CA-ON).`,
      };
    }
    return { ok: true, value: trimmed };
  }
  if (trimmed.length > 10) {
    return { ok: false, message: 'provinceState must be at most 10 characters' };
  }
  return { ok: true, value: trimmed };
}

/** Returns an error message or null — same rules as normalizeProvinceStateForCountry. */
export function validateProvinceStateForCountry(
  country: string,
  provinceState: string | null | undefined,
): string | null {
  const r = normalizeProvinceStateForCountry(country, provinceState);
  return r.ok ? null : r.message;
}
