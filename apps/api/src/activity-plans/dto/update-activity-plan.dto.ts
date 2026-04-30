import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { INCENTIVE_REGIONS } from '@storyos/types';

const VALID_REGION_CODES = INCENTIVE_REGIONS.map((r) => r.code);

export class UpdateActivityPlanDto {
  @IsOptional()
  @IsString()
  @IsIn(VALID_REGION_CODES)
  regionCode?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  productionPhaseId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  plannedDays?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
