import { IsOptional, IsString, IsDateString, MaxLength } from 'class-validator';

export class CreateProgramApplicationDto {
  @IsOptional()
  @IsDateString()
  targetFilingDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
