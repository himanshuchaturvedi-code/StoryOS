import { IsString, IsOptional, IsEnum, MinLength, MaxLength } from 'class-validator';
import { ProjectStatus } from '@storyos/types';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}
