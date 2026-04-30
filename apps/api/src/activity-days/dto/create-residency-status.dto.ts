import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, Validate } from 'class-validator';
import { ResidencyType } from '@storyos/types';
import { ProvinceStateForCountryConstraint } from '../../common/validators/province-state-for-country.validator';

export class CreateResidencyStatusDto {
  @IsString()
  personId!: string;

  @IsEnum(ResidencyType)
  residencyType!: ResidencyType;

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
