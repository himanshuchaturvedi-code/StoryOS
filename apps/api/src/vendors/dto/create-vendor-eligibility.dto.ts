import { IsDateString, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { EligibilityStatus } from '@storyos/types';

export class CreateVendorEligibilityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  programCode!: string;

  @IsOptional()
  @IsEnum(EligibilityStatus)
  status?: EligibilityStatus;

  @IsDateString()
  effectiveFrom!: string;

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
