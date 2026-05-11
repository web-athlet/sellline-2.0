import { IsNotEmpty, IsString } from 'class-validator';

export class MergeContactsDto {
  @IsString()
  @IsNotEmpty()
  masterId!: string;

  @IsString()
  @IsNotEmpty()
  duplicateId!: string;
}
