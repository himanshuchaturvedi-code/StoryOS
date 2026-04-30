import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateBudgetDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  baseCurrency?: string;
}
