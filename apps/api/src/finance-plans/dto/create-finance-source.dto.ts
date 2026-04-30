import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { FinanceSourceType, FinanceSourceStatus } from '@storyos/types';

export class CreateFinanceSourceDto {
  @IsEnum(FinanceSourceType)
  sourceType!: FinanceSourceType;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsNumber()
  amount!: number;

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
