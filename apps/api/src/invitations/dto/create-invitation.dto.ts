import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { OrgRole } from '@storyos/types';

export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsEnum(OrgRole)
  role?: OrgRole;
}
