import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, Validate } from 'class-validator';
import { ResidencyType } from '@storyos/types';
import { ProvinceStateForCountryConstraint } from '../../common/validators/province-state-for-country.validator';

export class UpdateResidencyStatusDto {
  @IsOptional()
  @IsEnum(ResidencyType)
  residencyType?: ResidencyType;

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
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
