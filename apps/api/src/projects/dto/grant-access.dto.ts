import { IsEnum, IsUUID } from 'class-validator';
import { ProjectRole } from '@storyos/types';

export class GrantProjectAccessDto {
  @IsUUID()
  userId!: string;

  @IsEnum(ProjectRole)
  role!: ProjectRole;
}
