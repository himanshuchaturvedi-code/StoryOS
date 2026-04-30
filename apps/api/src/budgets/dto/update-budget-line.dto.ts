import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBudgetLineDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsNumber()
  unitCost?: number;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsNumber()
  fringeRate?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
