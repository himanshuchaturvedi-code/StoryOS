import { IsString, IsUUID } from 'class-validator';

export class AddParticipantDto {
  @IsString()
  @IsUUID()
  personId!: string;
}
