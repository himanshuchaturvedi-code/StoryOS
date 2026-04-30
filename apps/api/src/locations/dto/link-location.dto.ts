import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class LinkLocationDto {
  @IsString()
  @IsUUID()
  locationId!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
