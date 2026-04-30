import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateFinancePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  baseCurrency?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
