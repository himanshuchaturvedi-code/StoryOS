import { IsString, IsOptional, IsDateString, MinLength, MaxLength } from 'class-validator';

export class CreateMilestoneDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  actualDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
