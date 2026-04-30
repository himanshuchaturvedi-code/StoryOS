import { IsEnum } from 'class-validator';
import { OrgRole } from '@storyos/types';

export class UpdateMemberRoleDto {
  @IsEnum(OrgRole)
  role!: OrgRole;
}
