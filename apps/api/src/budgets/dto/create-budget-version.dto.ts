import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateBudgetVersionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  cloneFromVersionId?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  templateId?: string;
}
