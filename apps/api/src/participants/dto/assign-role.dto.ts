import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignRoleDto {
  @IsString()
  @IsUUID()
  roleTypeId!: string;

  @IsOptional()
  @IsUUID()
  productionPhaseId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
