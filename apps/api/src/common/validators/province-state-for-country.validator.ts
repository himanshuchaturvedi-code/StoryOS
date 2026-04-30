import { normalizeProvinceStateForCountry } from '@storyos/types';
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/** Validates provinceState against `country` on the same DTO (trim + exact CA codes). If `country` is omitted (PATCH), validation is skipped — merge in the service layer. */
@ValidatorConstraint({ name: 'provinceStateForCountry', async: false })
export class ProvinceStateForCountryConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    const o = args.object as { country?: string };
    if (!o.country) return true;
    return normalizeProvinceStateForCountry(o.country, value as string | null | undefined).ok;
  }

  defaultMessage(args: ValidationArguments) {
    const o = args.object as { country?: string };
    if (!o.country) return 'Invalid provinceState';
    const r = normalizeProvinceStateForCountry(o.country!, args.value as string | null | undefined);
    return r.ok ? 'Invalid provinceState' : r.message;
  }
}
