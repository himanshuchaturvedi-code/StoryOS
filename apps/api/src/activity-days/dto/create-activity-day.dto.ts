import { IsDateString, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateActivityDayDto {
  @IsString()
  @IsUUID()
  personId!: string;

  @IsString()
  @IsUUID()
  roleTypeId!: string;

  @IsString()
  @IsUUID()
  locationId!: string;

  @IsOptional()
  @IsString()
  @IsUUID()
  productionPhaseId?: string;

  @IsDateString()
  activityDate!: string;

  @IsOptional()
  @IsNumber()
  hoursWorked?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
