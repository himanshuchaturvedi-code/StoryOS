import { CANADIAN_PROVINCE_LABELS, type CanadianProvince } from '@storyos/types';

/** Human-readable province for tables; Canadian rows use the canonical label when known. */
export function formatProvinceStateCell(country: string, provinceState: string | null | undefined): string {
  if (!provinceState) return '—';
  if (country === 'CA') {
    const label = CANADIAN_PROVINCE_LABELS[provinceState as CanadianProvince];
    return label ?? provinceState;
  }
  return provinceState;
}
