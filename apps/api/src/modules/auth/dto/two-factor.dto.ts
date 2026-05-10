import { IsOptional, IsString, Length, MinLength } from 'class-validator';

export class TwoFactorCodeDto {
  @IsString()
  @Length(6, 6, { message: '2FA code must be exactly 6 digits' })
  code!: string;
}

export class DisableTwoFactorDto {
  @IsString()
  @MinLength(1)
  password!: string;

  @IsString()
  @Length(6, 6, { message: '2FA code must be exactly 6 digits' })
  code!: string;
}

export class ValidateTwoFactorDto {
  @IsString()
  @Length(6, 6)
  code!: string;

  @IsOptional()
  @IsString()
  preAuthToken?: string;
}
