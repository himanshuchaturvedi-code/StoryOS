import { IsOptional, IsString, IsUUID, IsEnum, IsDateString, MaxLength } from 'class-validator';
import { SubmissionStatus, EvaluationSource } from '@storyos/types';

export class UpdateSubmissionDto {
  @IsOptional()
  @IsEnum(SubmissionStatus)
  status?: SubmissionStatus;

  @IsOptional()
  @IsDateString()
  evaluationDate?: string;

  @IsOptional()
  @IsUUID()
  budgetVersionId?: string;

  @IsOptional()
  @IsEnum(EvaluationSource)
  evaluationSource?: EvaluationSource;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalRef?: string;

  @IsOptional()
  @IsDateString()
  responseDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
