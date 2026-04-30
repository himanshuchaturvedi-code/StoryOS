import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { VendorType } from '@storyos/types';

export class CreateVendorDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsEnum(VendorType)
  vendorType!: VendorType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  registrationNum?: string;

  @IsString()
  @MaxLength(2)
  country!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
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
  @IsBoolean()
  isCanadianOwned?: boolean;

  @IsOptional()
  @IsString()
  @IsUUID()
  principalPersonId?: string;

  @IsOptional()
  @IsBoolean()
  isRelatedParty?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
