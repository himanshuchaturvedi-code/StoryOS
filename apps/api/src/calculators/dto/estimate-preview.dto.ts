import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class EstimatePreviewDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  programIds?: string[];

  @IsOptional()
  @IsString()
  @IsUUID()
  budgetVersionId?: string;
}
