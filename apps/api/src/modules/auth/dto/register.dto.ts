import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~])/;
const PASSWORD_MESSAGE =
  'Password must contain at least 1 uppercase letter, 1 digit and 1 special character';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password!: string;
}

export const PASSWORD_VALIDATORS = { PATTERN: PASSWORD_PATTERN, MESSAGE: PASSWORD_MESSAGE };
