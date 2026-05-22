import { IsArray, IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class SendEmailDto {
  @IsArray()
  @IsEmail({}, { each: true })
  to!: string[];

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  cc?: string[];

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  bcc?: string[];

  @IsString()
  @MinLength(1)
  subject!: string;

  @IsString()
  @MinLength(1)
  bodyHtml!: string;

  @IsOptional()
  @IsUUID()
  dealId?: string;

  @IsOptional()
  @IsString()
  threadId?: string;

  @IsOptional()
  @IsString()
  inReplyToMessageId?: string;
}
