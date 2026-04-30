import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { FinanceSourceType, FinanceSourceStatus } from '@storyos/types';

export class UpdateFinanceSourceDto {
  @IsOptional()
  @IsEnum(FinanceSourceType)
  sourceType?: FinanceSourceType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsEnum(FinanceSourceStatus)
  status?: FinanceSourceStatus;

  @IsOptional()
  @IsString()
  conditions?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
