import { IsString, IsOptional, MinLength, MaxLength, IsUUID } from 'class-validator';

export class AcceptInvitationDto {
  @IsUUID()
  token!: string;

  /** Required if the invitee does not have an existing account. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  /** Required if the invitee does not have an existing account. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  /** Required if the invitee does not have an existing account. */
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;
}
