import { IsDateString, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateActualLineDto {
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

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsNumber()
  baseCurrencyAmount?: number;

  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @IsOptional()
  @IsDateString()
  postedDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
