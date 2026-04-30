import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateProjectOwnershipDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  entityName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  entityCountry?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ownershipPercentage?: number;

  @ValidateIf(o => o.isProducer === true)
  @IsNotEmpty({ message: 'entityProvinceState is required when isProducer is true' })
  @IsString()
  @MaxLength(2)
  entityProvinceState?: string;

  @IsOptional()
  @IsBoolean()
  isProducer?: boolean;

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
