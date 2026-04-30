'use client';

import { CANADIAN_PROVINCE_CODE_SET, CANADIAN_PROVINCE_OPTIONS } from '@storyos/types';

type Props = {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
};

export function CanadianProvinceSelect({ id, value, onChange, disabled, className }: Props) {
  const hasLegacyValue = Boolean(value) && !CANADIAN_PROVINCE_CODE_SET.has(value);

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-500">
        Province / State
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-500"
      >
        <option value="">—</option>
        {hasLegacyValue && (
          <option value={value}>{value} (unrecognized — select a standard code)</option>
        )}
        {CANADIAN_PROVINCE_OPTIONS.map(({ code, label }) => (
          <option key={code} value={code}>
            {label} ({code})
          </option>
        ))}
      </select>
    </div>
  );
}
