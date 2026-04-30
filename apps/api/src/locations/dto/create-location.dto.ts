import {
  IsEnum,
  IsIn,
  IsISO31661Alpha2,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
} from 'class-validator';
import { LocationType, SUPPORTED_COUNTRIES, ZONE_CODES, INCENTIVE_REGION_CODES } from '@storyos/types';
import { ProvinceStateForCountryConstraint } from '../../common/validators/province-state-for-country.validator';

export class CreateLocationDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsISO31661Alpha2()
  @IsIn(SUPPORTED_COUNTRIES)
  country!: string;

  @IsOptional()
  @Validate(ProvinceStateForCountryConstraint)
  provinceState?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsOptional()
  @IsEnum(LocationType)
  locationType?: LocationType;

  @IsOptional()
  @IsIn(ZONE_CODES)
  zoneCode?: string;

  @IsOptional()
  @IsString()
  @IsIn(INCENTIVE_REGION_CODES)
  incentiveRegionCode?: string;

  @IsOptional()
  @IsNumber()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @IsLongitude()
  longitude?: number;
}
