import { IsOptional, IsString, IsUUID, IsEnum, IsObject, MaxLength } from 'class-validator';
import { EvidenceType, FactSourceType } from '@storyos/types';

export class UpdateEvidenceDto {
  @IsOptional()
  @IsEnum(EvidenceType)
  evidenceType?: EvidenceType;

  @IsOptional()
  @IsEnum(FactSourceType)
  factSource?: FactSourceType;

  @IsOptional()
  @IsObject()
  factQuery?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  documentId?: string;

  @IsOptional()
  @IsObject()
  manualPayload?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
