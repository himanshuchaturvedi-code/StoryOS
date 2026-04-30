export function formatDate(value: string | null | undefined, locale = 'en-CA') {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(locale);
}

export function formatCurrency(
  value: number | string,
  currency = 'CAD',
  locale = 'en-CA',
) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(Number(value));
}
