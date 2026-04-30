import { IsDateString, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateActivityDayDto {
  @IsOptional()
  @IsString()
  @IsUUID()
  personId?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  roleTypeId?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  productionPhaseId?: string;

  @IsOptional()
  @IsDateString()
  activityDate?: string;

  @IsOptional()
  @IsNumber()
  hoursWorked?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
