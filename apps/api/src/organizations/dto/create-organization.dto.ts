import { IsString, IsOptional, IsEnum, MinLength, MaxLength, IsEmail, IsUrl } from 'class-validator';
import { OrgType } from '@storyos/types';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsEnum(OrgType)
  type?: OrgType;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsUrl()
  website?: string;
}
