import { IsOptional, IsString, IsEnum, IsDateString, MaxLength } from 'class-validator';
import { ProgramApplicationStatus } from '@storyos/types';

export class UpdateProgramApplicationDto {
  @IsOptional()
  @IsEnum(ProgramApplicationStatus)
  status?: ProgramApplicationStatus;

  @IsOptional()
  @IsDateString()
  targetFilingDate?: string | null;

  @IsOptional()
  @IsDateString()
  filedAt?: string | null;

  @IsOptional()
  @IsDateString()
  decidedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalRef?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
