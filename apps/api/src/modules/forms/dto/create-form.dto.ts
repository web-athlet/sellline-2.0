import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateFormDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  schemaJson!: unknown[];

  @IsArray()
  @IsEmail({}, { each: true })
  @IsOptional()
  notifyEmails?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
