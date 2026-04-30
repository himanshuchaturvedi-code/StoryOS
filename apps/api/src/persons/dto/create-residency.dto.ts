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

export class CreateResidencyDto {
  @IsEnum(RESIDENCY_TYPES)
  residencyType!: string;

  @IsString()
  @MaxLength(2)
  country!: string;

  @IsOptional()
  @Validate(ProvinceStateForCountryConstraint)
  provinceState?: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
