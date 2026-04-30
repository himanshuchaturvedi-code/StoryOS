import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateActualLineDto {
  @IsString()
  @IsUUID()
  budgetAccountId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoiceRef?: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsNumber()
  baseCurrencyAmount?: number;

  @IsDateString()
  transactionDate!: string;

  @IsOptional()
  @IsDateString()
  postedDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
