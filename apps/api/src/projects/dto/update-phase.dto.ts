import { IsEnum, IsOptional, IsDateString, IsString } from 'class-validator';
import { PhaseType } from '@storyos/types';

export class UpdateProductionPhaseDto {
  @IsOptional()
  @IsEnum(PhaseType)
  phaseType?: PhaseType;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
