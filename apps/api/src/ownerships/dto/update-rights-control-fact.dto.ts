import { IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';
import { ControlType } from '@storyos/types';

export class UpdateRightsControlFactDto {
  @IsOptional()
  @IsEnum(ControlType)
  controlType?: ControlType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  holderName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  holderCountry?: string;

  @ValidateIf(o => o.controlType === ControlType.COPYRIGHT_OWNERSHIP)
  @IsNotEmpty({ message: 'holderProvinceState is required when setting controlType to COPYRIGHT_OWNERSHIP' })
  @IsString()
  @MaxLength(2)
  holderProvinceState?: string;

  @ValidateIf(o => o.controlType === ControlType.COPYRIGHT_OWNERSHIP)
  @IsNotEmpty({ message: 'retentionYears is required when setting controlType to COPYRIGHT_OWNERSHIP' })
  @IsInt()
  @Min(10, { message: 'retentionYears must be at least 10 for COPYRIGHT_OWNERSHIP (FTTC elevated tier)' })
  retentionYears?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  assertion?: string;

  @IsOptional()
  @IsString()
  evidenceNotes?: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
