import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { INCENTIVE_REGIONS } from '@storyos/types';

const VALID_REGION_CODES = INCENTIVE_REGIONS.map((r) => r.code);

export class CreateActivityPlanDto {
  @IsString()
  @IsIn(VALID_REGION_CODES)
  regionCode!: string;

  @IsString()
  @IsUUID()
  productionPhaseId!: string;

  @IsInt()
  @Min(1)
  plannedDays!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
