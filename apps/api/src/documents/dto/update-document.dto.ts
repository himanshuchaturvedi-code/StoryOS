import { Allow, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DocumentCategory } from '@storyos/types';

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @IsOptional()
  @Allow()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @Allow()
  @IsString()
  @MaxLength(32)
  programCode?: string | null;

  @IsOptional()
  @Allow()
  @IsString()
  @MaxLength(64)
  programDocumentCode?: string | null;
}
