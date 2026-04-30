import { IsDateString, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateCorporateOwnershipDto {
  @IsString()
  @MaxLength(200)
  parentEntityName!: string;

  @IsString()
  @MaxLength(2)
  parentEntityCountry!: string;

  @IsString()
  @MaxLength(200)
  childEntityName!: string;

  @IsString()
  @MaxLength(2)
  childEntityCountry!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  ownershipPercentage!: number;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
