import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
} from 'class-validator';
import { ProvinceStateForCountryConstraint } from '../../common/validators/province-state-for-country.validator';

const RESIDENCY_TYPES = ['CITIZEN', 'PERMANENT_RESIDENT', 'TEMPORARY_RESIDENT', 'NON_RESIDENT'] as const;

export class UpdateResidencyDto {
  @IsOptional()
  @IsEnum(RESIDENCY_TYPES)
  residencyType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @IsOptional()
  @Validate(ProvinceStateForCountryConstraint)
  provinceState?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;

  @IsOptional()
  @IsString()
  notes?: string;
}
