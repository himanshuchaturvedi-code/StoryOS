import { IsArray, ValidateNested, IsUUID, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { EvaluationSource } from '@storyos/types';

export class AccountSourceEntry {
  @IsUUID()
  budgetAccountId!: string;

  @IsEnum(EvaluationSource)
  source!: EvaluationSource;
}

export class SetAccountSourcesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccountSourceEntry)
  accounts!: AccountSourceEntry[];
}
