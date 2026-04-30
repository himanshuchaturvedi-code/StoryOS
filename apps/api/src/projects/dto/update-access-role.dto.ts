import { IsEnum } from 'class-validator';
import { ProjectRole } from '@storyos/types';

export class UpdateProjectAccessRoleDto {
  @IsEnum(ProjectRole)
  role!: ProjectRole;
}
