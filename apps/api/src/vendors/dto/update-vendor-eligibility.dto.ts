import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EligibilityStatus } from '@storyos/types';

export class UpdateVendorEligibilityDto {
  @IsOptional()
  @IsEnum(EligibilityStatus)
  status?: EligibilityStatus;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  certificationRef?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
