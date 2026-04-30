import {
  IsOptional,
  IsString,
  IsUUID,
  IsEnum,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ProjectProgramStatus } from '@storyos/types';

export class CreateProjectProgramDto {
  @IsUUID()
  programVersionId!: string;

  @IsOptional()
  @IsEnum(ProjectProgramStatus)
  status?: ProjectProgramStatus;

  @IsOptional()
  @IsDateString()
  targetSubmissionDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
