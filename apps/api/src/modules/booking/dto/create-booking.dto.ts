import { IsEmail, IsISO8601, IsNotEmpty, IsString } from 'class-validator';

export class CreateBookingDto {
  @IsISO8601()
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  guestName!: string;

  @IsEmail()
  guestEmail!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  guestNotes?: string;
}
