import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { ExpenseType, ActivityType } from '@storyos/types';

export class AnnotateBudgetLineDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  personId?: string | null;

  @IsOptional()
  @IsString()
  @IsUUID()
  vendorId?: string | null;

  @IsOptional()
  @IsString()
  @IsUUID()
  locationId?: string | null;

  @IsOptional()
  @IsString()
  @IsUUID()
  productionPhaseId?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  labourAmount?: number | null;

  @IsOptional()
  @IsEnum(ExpenseType)
  expenseType?: ExpenseType | null;

  @IsOptional()
  @IsEnum(ActivityType)
  activityType?: ActivityType | null;

  @IsOptional()
  @IsBoolean()
  isServiceContract?: boolean | null;

  @IsOptional()
  @IsString()
  notes?: string;
}
