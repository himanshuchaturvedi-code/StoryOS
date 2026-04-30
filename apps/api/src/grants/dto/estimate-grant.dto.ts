import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const PROVINCE_CODES = ['ON', 'BC', 'AB', 'MB'] as const;
export type SupportedProvinceCode = (typeof PROVINCE_CODES)[number];

const SOURCE_CODES = ['BUDGET', 'ACTUAL', 'BLENDED'] as const;
export type GrantEstimateSource = (typeof SOURCE_CODES)[number];

/**
 * Optional caller overrides for opts that the adapter cannot reliably derive
 * from StoryOS data alone (notably the GTA / Vancouver / Winnipeg-area flags
 * when a project hasn't enriched its locations with `incentiveRegionCode`).
 */
export class GrantEstimateOptsOverridesDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  totalDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  daysProvincial?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  daysDistant?: number;

  @IsOptional()
  @IsIn(['OPSTC', 'OCASE'])
  onStream?: 'OPSTC' | 'OCASE';

  @IsOptional()
  @IsBoolean()
  onOutsideGTA?: boolean;

  @IsOptional()
  @IsBoolean()
  onOutsideEntireGTA?: boolean;

  @IsOptional()
  @IsBoolean()
  bcRegionalOn?: boolean;

  @IsOptional()
  @IsBoolean()
  bcDistantOn?: boolean;

  @IsOptional()
  @IsBoolean()
  bcDaveOn?: boolean;

  @IsOptional()
  @IsBoolean()
  mbRuralOn?: boolean;

  @IsOptional()
  @IsBoolean()
  mbNorthernOn?: boolean;

  @IsOptional()
  @IsBoolean()
  mbOwnershipOn?: boolean;
}

export class GrantEstimateMetaOverridesDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  provincialOwnershipPercent?: number;

  @IsOptional()
  @IsString()
  copyrightHolderName?: string;

  @IsOptional()
  @IsString()
  copyrightJurisdictionProvince?: string;

  @IsOptional()
  @IsString()
  copyrightJurisdictionCountry?: string;
}

export class GrantEstimatePriorAssistanceDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  total?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  labour?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  nonLabour?: number;
}

export class EstimateGrantDto {
  @IsUUID()
  projectId!: string;

  @IsOptional()
  @IsIn(PROVINCE_CODES as unknown as string[])
  province?: SupportedProvinceCode;

  @IsOptional()
  @IsIn(SOURCE_CODES as unknown as string[])
  source?: GrantEstimateSource;

  @IsOptional()
  @IsUUID()
  budgetVersionId?: string;

  @IsOptional()
  accountSourceOverrides?: Record<string, GrantEstimateSource>;

  @IsOptional()
  @ValidateNested()
  @Type(() => GrantEstimateOptsOverridesDto)
  opts?: GrantEstimateOptsOverridesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GrantEstimateMetaOverridesDto)
  meta?: GrantEstimateMetaOverridesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => GrantEstimatePriorAssistanceDto)
  priorAssistance?: GrantEstimatePriorAssistanceDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  labourMultiplier?: number;
}

export const SUPPORTED_PROVINCES = PROVINCE_CODES;
