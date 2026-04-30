import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Stage } from '@storyos/types';

export class UpdateStageDto {
  @IsEnum(Stage)
  stage!: Stage;

  @IsOptional()
  @IsString()
  notes?: string;
}
