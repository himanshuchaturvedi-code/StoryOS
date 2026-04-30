import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/**
 * Bulk-derive ExpenseFacts from ActualLines that don't have one yet.
 * Applies uniform annotation to all derived records.
 */
export class DeriveExpenseFactsDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  vendorId?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  productionPhaseId?: string;

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
}
