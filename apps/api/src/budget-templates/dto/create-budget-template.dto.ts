import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBudgetTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
