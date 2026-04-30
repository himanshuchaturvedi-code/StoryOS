import { IsEnum, IsString, MinLength, MaxLength } from 'class-validator';
import { AssessmentResult } from '@storyos/types';

export class OverrideAssessmentDto {
  @IsEnum(AssessmentResult)
  overrideResult!: AssessmentResult;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  overrideReason!: string;
}
