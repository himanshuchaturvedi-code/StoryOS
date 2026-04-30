import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  MaxLength,
} from 'class-validator';

export class UpsertProjectMetadataDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logline?: string;

  @IsOptional()
  @IsString()
  synopsis?: string;

  @IsOptional()
  @IsString()
  genre?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  originalLanguage?: string;

  @IsOptional()
  @IsString()
  targetAudience?: string;

  @IsOptional()
  @IsString()
  countryOfOrigin?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  productionYear?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];
}
