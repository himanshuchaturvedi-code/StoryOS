import {
  IsEnum,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsString,
} from 'class-validator';
import { FormatType } from '@storyos/types';

export class UpsertProjectFormatDto {
  @IsEnum(FormatType)
  formatType!: FormatType;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalRuntimeMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  numberOfEpisodes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  episodeRuntimeMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  numberOfSeasons?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  seasonNumber?: number;

  @IsOptional()
  @IsString()
  aspectRatio?: string;

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsBoolean()
  isLiveAction?: boolean;

  @IsOptional()
  @IsBoolean()
  hasAnimation?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  animationPercentage?: number;
}
