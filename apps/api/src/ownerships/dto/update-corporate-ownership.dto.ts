import { IsDateString, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateCorporateOwnershipDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  parentEntityName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  parentEntityCountry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  childEntityName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  childEntityCountry?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ownershipPercentage?: number;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
