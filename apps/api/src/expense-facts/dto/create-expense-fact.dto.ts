import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class CreateExpenseFactDto {
  @IsString()
  @IsUUID()
  actualLineId!: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  vendorId?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  personId?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  productionPhaseId?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  budgetAccountId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  eligiblePortion?: number;

  @IsOptional()
  @IsBoolean()
  labourFlag?: boolean;

  @IsOptional()
  @IsBoolean()
  serviceFlag?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
