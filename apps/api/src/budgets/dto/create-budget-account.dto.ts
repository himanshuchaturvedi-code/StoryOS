import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { BudgetAccountType, CptcRole } from '@storyos/types';

export class CreateBudgetAccountDto {
  @IsString()
  @MaxLength(50)
  code!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsEnum(BudgetAccountType)
  accountType?: BudgetAccountType;

  @IsOptional()
  @IsEnum(CptcRole)
  cptcRole?: CptcRole;

  @IsOptional()
  @IsBoolean()
  isHeader?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @IsUUID()
  parentId?: string;
}
