import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_VALIDATORS } from './register.dto';

export class ResetPasswordDto {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_VALIDATORS.PATTERN, { message: PASSWORD_VALIDATORS.MESSAGE })
  newPassword!: string;
}
