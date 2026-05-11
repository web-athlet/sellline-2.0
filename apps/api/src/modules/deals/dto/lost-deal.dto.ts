import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LostDealDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  lostReason!: string;
}
