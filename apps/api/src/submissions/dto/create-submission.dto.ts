import { IsOptional, IsString, IsUUID, IsDateString, IsEnum, MaxLength } from 'class-validator';
import { EvaluationSource } from '@storyos/types';

export class CreateSubmissionDto {
  @IsDateString()
  evaluationDate!: string;

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
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
