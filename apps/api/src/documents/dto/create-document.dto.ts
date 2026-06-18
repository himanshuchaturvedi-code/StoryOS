import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { DocumentCategory } from '@storyos/types';

export class CreateDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MaxLength(100)
  fileType!: string;

  @IsInt()
  @IsPositive()
  fileSize!: number;

  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  programCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  programDocumentCode?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  projectId?: string;
}
